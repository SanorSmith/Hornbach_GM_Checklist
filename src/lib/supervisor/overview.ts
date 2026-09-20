import { CHECKLIST_CATALOGUE, getSeed, getTemplate } from '@/lib/checklists';
import { STORE_TIME_ZONE } from '@/lib/config';
import { repository } from '@/lib/repo';
import type { RunControl, RunDetail } from '@/lib/repo/types';
import { evaluateRun } from '@/lib/rules/evaluate';
import { zonedToInstant } from '@/lib/rules/time';
import { toEngineItems } from '@/lib/runs/engine-input';

/**
 * What the group leader needs to know about one checklist, today.
 *
 * `NOT_STARTED` is the state that matters most and the one a list of runs
 * cannot show you, because a checklist nobody opened has no run to list. So
 * this walks the catalogue rather than the runs, and fills in what exists.
 */
export type RunStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'READY_TO_SIGN' | 'SIGNED';

export interface ChecklistOverview {
  code: string;
  nameSv: string;
  roleSv: string;
  shift: string;
  windowSv: string;
  status: RunStatus;
  runId: string | null;
  /** Display name of whoever opened it, or null if nobody has. */
  performedBy: string | null;
  signedBy: string | null;
  signedAt: string | null;
  /** Efterkontroll. PENDING on anything not yet reviewed, signed or not. */
  control: RunControl;
  /** Who was meant to do it, which is not the same as who did. */
  assignedTo: { id: string; name: string } | null;
  progress: { answered: number; applicable: number; overdue: number; blocked: number };
  /** True when a deadline on an unanswered point has already passed. */
  isLate: boolean;
}

export interface SupervisorOverview {
  businessDate: string;
  checklists: ChecklistOverview[];
  totals: {
    notStarted: number;
    inProgress: number;
    readyToSign: number;
    signed: number;
    overdue: number;
    /** Assigned to someone and still untouched — the ones worth chasing. */
    unstartedButAssigned: number;
    /** Signed lists nobody has reviewed — the supervisor's actual queue. */
    awaitingControl: number;
  };
}

function statusOf(run: RunDetail | undefined, canSubmit: boolean): RunStatus {
  if (!run) return 'NOT_STARTED';
  if (run.status === 'SUBMITTED') return 'SIGNED';
  return canSubmit ? 'READY_TO_SIGN' : 'IN_PROGRESS';
}

/**
 * Builds the overview for one business date.
 *
 * `now` is passed in rather than read here: the deadline maths depends on it,
 * and a function that reads the clock cannot be tested against a fixed morning.
 */
export async function buildSupervisorOverview(
  businessDate: string,
  now: Date,
): Promise<SupervisorOverview> {
  const repo = repository();
  const [runs, users, assignments] = await Promise.all([
    repo.listRunsForDate(businessDate),
    repo.listUsers(),
    repo.listAssignments(businessDate),
  ]);

  const nameById = new Map(users.map((u) => [u.id, u.displayName]));
  const runByTemplate = new Map(runs.map((r) => [r.templateCode, r]));
  // Slot 1 is the list's owner; slot 2 is the evening list's "Person 2".
  const assignmentByTemplate = new Map(
    assignments.filter((a) => a.slot === 1).map((a) => [a.templateCode, a]),
  );

  const checklists: ChecklistOverview[] = [];

  for (const entry of CHECKLIST_CATALOGUE) {
    const template = getTemplate(entry.code);
    const seed = getSeed(entry.code);
    if (!template || !seed) continue;

    const run = runByTemplate.get(entry.code);

    let progress = { answered: 0, applicable: template.items.length, overdue: 0, blocked: 0 };
    let canSubmit = false;

    if (run) {
      // Photo counts come from the attachments, and leaving them out is how a
      // photo-required point looks answered when it is not.
      const attachments = await repo.listAttachments(run.id);
      const evaluation = evaluateRun({
        template,
        run: {
          businessDate,
          shift: template.shift,
          timeZone: STORE_TIME_ZONE,
          shiftStartAt: zonedToInstant(businessDate, seed.shiftStart, STORE_TIME_ZONE).toISOString(),
          shiftEndAt: zonedToInstant(businessDate, seed.shiftEnd, STORE_TIME_ZONE).toISOString(),
        },
        items: toEngineItems(template, run.items, attachments),
        now,
      });
      canSubmit = evaluation.canSubmit;
      progress = {
        answered: evaluation.progress.answered,
        applicable: evaluation.progress.applicable,
        overdue: evaluation.progress.overdue,
        blocked: evaluation.progress.blocked,
      };
    }

    // The worker's sign-off specifically: a control signature also lives here,
    // and showing the reviewer as the person who did the list would be wrong.
    const signature = run?.signatures?.find((sig) => sig.purpose === 'WORKER_SUBMIT') ?? null;

    checklists.push({
      code: entry.code,
      nameSv: entry.nameSv,
      roleSv: entry.roleSv,
      shift: entry.shift,
      windowSv: entry.windowSv,
      status: statusOf(run, canSubmit),
      runId: run?.id ?? null,
      performedBy: run?.createdBy ? (nameById.get(run.createdBy) ?? null) : null,
      signedBy: signature?.displayName ?? null,
      signedAt: signature?.signedAt ?? null,
      control: run?.control ?? { status: 'PENDING', by: null, at: null, note: null },
      assignedTo: (() => {
        const a = assignmentByTemplate.get(entry.code);
        return a ? { id: a.assignedTo, name: a.assignedToName } : null;
      })(),
      progress,
      isLate: progress.overdue > 0,
    });
  }

  return {
    businessDate,
    checklists,
    totals: {
      notStarted: checklists.filter((c) => c.status === 'NOT_STARTED').length,
      inProgress: checklists.filter((c) => c.status === 'IN_PROGRESS').length,
      readyToSign: checklists.filter((c) => c.status === 'READY_TO_SIGN').length,
      signed: checklists.filter((c) => c.status === 'SIGNED').length,
      overdue: checklists.filter((c) => c.isLate).length,
      unstartedButAssigned: checklists.filter(
        (c) => c.status === 'NOT_STARTED' && c.assignedTo !== null,
      ).length,
      awaitingControl: checklists.filter(
        (c) => c.status === 'SIGNED' && c.control.status === 'PENDING',
      ).length,
    },
  };
}
