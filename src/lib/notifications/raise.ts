import type { AuthUser } from '@/lib/auth/types';
import { getSeed } from '@/lib/checklists';
import { STORE_TIME_ZONE } from '@/lib/config';
import { repository } from '@/lib/repo';
import { zonedToInstant } from '@/lib/rules/time';
import type { ChecklistOverview } from '@/lib/supervisor/overview';
import { detectOverdue, NOT_STARTED_GRACE_MINUTES, type ChecklistTiming } from './detect';
import { sendPushes } from './push';

/**
 * Turns "what is late" into rows for the people who should know.
 *
 * Shared between the nightly sweep and the supervisor's own screen. Vercel's
 * Hobby plan allows one cron run a day, which is enough to catch a list nobody
 * ever did but far too slow to tell anyone while the shift is still running.
 * Running the same check when a group leader opens their overview closes that
 * gap without a paid plan: the person most likely to act is the one loading the
 * page, and the work is already computed for them.
 *
 * Idempotent, so calling it from both places costs a handful of conflicting
 * inserts rather than duplicate notifications.
 */

/** The first moment something on the list is actually due. */
function firstDeadlineOf(
  seed: {
    shiftStart: string;
    sections: { items: { rules?: { timing?: { dueTime?: string } } }[] }[];
  },
  businessDate: string,
): Date {
  const times: string[] = [];
  for (const section of seed.sections) {
    for (const item of section.items) {
      const due = item.rules?.timing?.dueTime;
      if (due) times.push(due);
    }
  }

  // A list with no timed points is still worth raising if it is never started;
  // an hour into the shift is the fallback anchor.
  if (times.length === 0) {
    return new Date(
      zonedToInstant(businessDate, seed.shiftStart, STORE_TIME_ZONE).getTime() +
        NOT_STARTED_GRACE_MINUTES * 60_000,
    );
  }

  times.sort();
  return zonedToInstant(businessDate, times[0]!, STORE_TIME_ZONE);
}

export interface RaiseResult {
  checked: number;
  matched: number;
  created: number;
  pushed: number;
}

export async function raiseOverdueNotifications(input: {
  businessDate: string;
  now: Date;
  checklists: readonly ChecklistOverview[];
  users: readonly AuthUser[];
}): Promise<RaiseResult> {
  const { businessDate, now, checklists, users } = input;

  // Everyone responsible for the day getting done, whether or not they were
  // given a list themselves.
  const supervisorIds = users
    .filter((u) => u.isActive && (u.roles.includes('GROUP_LEADER') || u.roles.includes('ADMIN')))
    .map((u) => u.id);

  const timings: ChecklistTiming[] = [];
  for (const list of checklists) {
    const seed = getSeed(list.code);
    if (!seed) continue;
    timings.push({
      code: list.code,
      nameSv: list.nameSv,
      status: list.status,
      assignedTo: list.assignedTo,
      notStartedDueAt: firstDeadlineOf(seed, businessDate),
      endAt: zonedToInstant(businessDate, seed.shiftEnd, STORE_TIME_ZONE),
    });
  }

  const pending = detectOverdue({ now, checklists: timings, supervisorIds });
  const created = await repository().createNotifications(
    pending.map((p) => ({ ...p, businessDate })),
  );

  // Push only what was genuinely new. This runs on every supervisor page load,
  // so pushing everything it considered would notify the same person about the
  // same list all afternoon.
  const createdKeys = new Set(
    created.map((c) => `${c.templateCode}|${c.slot}|${c.recipientId}|${c.kind}`),
  );
  const fresh = pending.filter((p) =>
    createdKeys.has(`${p.templateCode}|${p.slot}|${p.recipientId}|${p.kind}`),
  );

  // Best-effort: a dead subscription or a push service outage must not fail the
  // notification row, which is the channel people can actually rely on.
  let pushed = 0;
  try {
    pushed = (await sendPushes(fresh)).sent;
  } catch {
    pushed = 0;
  }

  return { checked: timings.length, matched: pending.length, created: created.length, pushed };
}
