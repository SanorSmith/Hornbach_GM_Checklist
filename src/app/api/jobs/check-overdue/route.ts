import { NextResponse } from 'next/server';
import { getSeed, getTemplate } from '@/lib/checklists';
import { STORE_TIME_ZONE } from '@/lib/config';
import {
  detectOverdue,
  NOT_STARTED_GRACE_MINUTES,
  type ChecklistTiming,
} from '@/lib/notifications/detect';
import { repository } from '@/lib/repo';
import { businessDateOf, zonedToInstant } from '@/lib/rules/time';
import { buildSupervisorOverview } from '@/lib/supervisor/overview';

/**
 * The first moment something on the list is actually due.
 *
 * Falls back to an hour into the shift for a list with no timed points, so a
 * list that is simply never started is still reported.
 */
function firstDeadlineOf(
  seed: { shiftStart: string; sections: { items: { rules?: { timing?: { dueTime?: string } } }[] }[] },
  businessDate: string,
): Date {
  const times: string[] = [];
  for (const section of seed.sections) {
    for (const item of section.items) {
      const due = item.rules?.timing?.dueTime;
      if (due) times.push(due);
    }
  }

  if (times.length === 0) {
    return new Date(
      zonedToInstant(businessDate, seed.shiftStart, STORE_TIME_ZONE).getTime() +
        NOT_STARTED_GRACE_MINUTES * 60_000,
    );
  }

  times.sort();
  return zonedToInstant(businessDate, times[0]!, STORE_TIME_ZONE);
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Finds lists that are late and tells the people responsible.
 *
 * Scheduled rather than reactive, because the thing worth knowing is an
 * absence: nobody started the evening list. No user action happens to trigger
 * that, which is exactly why it goes unnoticed on paper.
 *
 * Idempotent — notifications dedupe on (day, list, slot, recipient, kind), so
 * running it every half hour tells each person once.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Unauthenticated, this endpoint reports who is behind on their work.
    return NextResponse.json({ ok: false, error: 'CRON_SECRET is not set.' }, { status: 503 });
  }

  const offered = request.headers.get('authorization');
  if (offered !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const now = new Date();
  const businessDate = businessDateOf(now, STORE_TIME_ZONE);

  const repo = repository();
  const [overview, users] = await Promise.all([
    buildSupervisorOverview(businessDate, now),
    repo.listUsers(),
  ]);

  // Everyone responsible for the day getting done, whether or not they were
  // given a list themselves.
  const supervisorIds = users
    .filter((u) => u.isActive && (u.roles.includes('GROUP_LEADER') || u.roles.includes('ADMIN')))
    .map((u) => u.id);

  const checklists: ChecklistTiming[] = [];
  for (const list of overview.checklists) {
    const template = getTemplate(list.code);
    const seed = getSeed(list.code);
    if (!template || !seed) continue;
    checklists.push({
      code: list.code,
      nameSv: list.nameSv,
      status: list.status,
      assignedTo: list.assignedTo,
      notStartedDueAt: firstDeadlineOf(seed, businessDate),
      endAt: zonedToInstant(businessDate, seed.shiftEnd, STORE_TIME_ZONE),
    });
  }

  const pending = detectOverdue({ now, checklists, supervisorIds });
  const created = await repo.createNotifications(
    pending.map((p) => ({ ...p, businessDate })),
  );

  return NextResponse.json({
    ok: true,
    businessDate,
    checked: checklists.length,
    matched: pending.length,
    created,
  });
}
