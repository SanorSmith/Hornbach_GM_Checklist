import { getSeed } from '@/lib/checklists';
import { STORE_TIME_ZONE } from '@/lib/config';
import { repository } from '@/lib/repo';
import type { RunSummaryRecord } from '@/lib/repo/types';
import { zonedToInstant } from '@/lib/rules/time';
import { rangeFor, type Period } from './history';

/**
 * The same period, grouped by person.
 *
 * Every figure here is about one named employee, so each is defined narrowly
 * and counted against the act it actually describes:
 *
 * - `signed` counts the worker's own signature, not who opened the list. One
 *   person can start a list and another finish it, and attributing the second
 *   person's lateness to the first is the obvious way to make this unfair. A
 *   list with two assignee slots is signed by two people and counts for both.
 * - `signedLate` is measured against the end of that list's shift, using that
 *   person's own signature time rather than the run's.
 * - `deviations` counts after-control verdicts on lists *they signed*, which
 *   records what a leader found — not a judgement this code is making.
 * - `assignedNotSigned` counts lists given to them that nobody signed that day.
 *   Nobody, not just them: a list someone else finished was still done.
 */

export interface PersonRow {
  userId: string;
  displayName: string;
  assigned: number;
  assignedNotSigned: number;
  opened: number;
  signed: number;
  signedLate: number;
  controlOk: number;
  deviations: number;
}

export interface PeopleReport {
  from: string;
  to: string;
  period: Period;
  days: number;
  people: PersonRow[];
}

/** True when this person put their name to the list after the shift was over. */
function signedLate(run: RunSummaryRecord, signedAt: string): boolean {
  const seed = getSeed(run.templateCode);
  if (!seed) return false;
  const end = zonedToInstant(run.businessDate, seed.shiftEnd, STORE_TIME_ZONE);
  return new Date(signedAt).getTime() > end.getTime();
}

export async function buildPeopleReport(period: Period, today: string): Promise<PeopleReport> {
  const { from, to, days } = rangeFor(period, today);
  const repo = repository();

  const [runs, assignments, users] = await Promise.all([
    repo.listRunsBetween(from, to),
    repo.listAssignmentsBetween(from, to),
    repo.listUsers(),
  ]);

  // Which (day, list) pairs ended up signed by anyone. An assignment is only
  // outstanding if the work itself never got done.
  const signedPairs = new Set(
    runs.filter((r) => r.status === 'SUBMITTED').map((r) => `${r.businessDate}|${r.templateCode}`),
  );

  const rows = new Map<string, PersonRow>();
  const row = (userId: string, displayName: string): PersonRow => {
    const existing = rows.get(userId);
    if (existing) return existing;
    const fresh: PersonRow = {
      userId,
      displayName,
      assigned: 0,
      assignedNotSigned: 0,
      opened: 0,
      signed: 0,
      signedLate: 0,
      controlOk: 0,
      deviations: 0,
    };
    rows.set(userId, fresh);
    return fresh;
  };

  // Everyone who could have done work in the period appears, including with
  // nothing against their name. A report that silently omits people is worse
  // than one that shows a row of zeroes.
  for (const user of users) {
    if (user.isActive) row(user.id, user.displayName);
  }

  for (const assignment of assignments) {
    const person = row(assignment.assignedTo, assignment.assignedToName);
    person.assigned += 1;
    if (!signedPairs.has(`${assignment.businessDate}|${assignment.templateCode}`)) {
      person.assignedNotSigned += 1;
    }
  }

  for (const run of runs) {
    if (run.performedById) {
      row(run.performedById, run.performedByName ?? '—').opened += 1;
    }

    if (run.status !== 'SUBMITTED') continue;

    // The leader's verdict is on the whole list, so on a two-slot list it
    // counts for both signers. Splitting a single verdict between them would
    // mean inventing which half it was about.
    for (const signer of run.signers) {
      const person = row(signer.userId, signer.displayName ?? '—');
      person.signed += 1;
      if (signedLate(run, signer.signedAt)) person.signedLate += 1;
      if (run.controlStatus === 'OK') person.controlOk += 1;
      if (run.controlStatus === 'NOT_OK' || run.controlStatus === 'FOLLOW_UP') {
        person.deviations += 1;
      }
    }
  }

  return {
    from,
    to,
    period,
    days,
    people: [...rows.values()].sort((a, b) => a.displayName.localeCompare(b.displayName, 'sv')),
  };
}
