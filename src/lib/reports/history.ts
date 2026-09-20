import { CHECKLIST_CATALOGUE, getSeed } from '@/lib/checklists';
import { STORE_TIME_ZONE } from '@/lib/config';
import { repository } from '@/lib/repo';
import type { ControlStatus, RunSummaryRecord } from '@/lib/repo/types';
import { zonedToInstant } from '@/lib/rules/time';

/**
 * Reporting over a period, about lists rather than people.
 *
 * "Which lists went unsigned last month" is an operational question. The same
 * query grouped by person is an appraisal, which is a different thing with
 * different obligations — so this deliberately reports per checklist, and the
 * names it carries are there to answer "who do I ask about this one", not to
 * be totalled.
 */

export type Period = 'week' | 'month' | 'year';

export interface ListHistory {
  code: string;
  nameSv: string;
  /** Days in the period the list should have been done — one run per day. */
  expected: number;
  started: number;
  signed: number;
  /** Signed after the shift had already ended. */
  signedLate: number;
  /** Signed but nobody has reviewed it. */
  awaitingControl: number;
  controlOk: number;
  controlNotOk: number;
  controlFollowUp: number;
}

export interface Deviation {
  businessDate: string;
  templateCode: string;
  nameSv: string;
  status: Exclude<ControlStatus, 'PENDING' | 'OK'>;
  note: string | null;
  performedByName: string | null;
  controlledByName: string | null;
}

export interface HistoryReport {
  from: string;
  to: string;
  period: Period;
  days: number;
  lists: ListHistory[];
  deviations: Deviation[];
  totals: { started: number; signed: number; signedLate: number; deviations: number };
}

/** Inclusive range ending today, in the store's own calendar. */
export function rangeFor(period: Period, today: string): { from: string; to: string; days: number } {
  const end = new Date(`${today}T00:00:00Z`);
  const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
  const start = new Date(end.getTime() - (days - 1) * 86_400_000);
  return { from: start.toISOString().slice(0, 10), to: today, days };
}

/** True when the worker's signature landed after the shift was already over. */
function signedLate(run: RunSummaryRecord): boolean {
  if (!run.submittedAt) return false;
  const seed = getSeed(run.templateCode);
  if (!seed) return false;
  const end = zonedToInstant(run.businessDate, seed.shiftEnd, STORE_TIME_ZONE);
  return new Date(run.submittedAt).getTime() > end.getTime();
}

export async function buildHistoryReport(period: Period, today: string): Promise<HistoryReport> {
  const { from, to, days } = rangeFor(period, today);
  const runs = await repository().listRunsBetween(from, to);

  const byTemplate = new Map<string, RunSummaryRecord[]>();
  for (const run of runs) {
    byTemplate.set(run.templateCode, [...(byTemplate.get(run.templateCode) ?? []), run]);
  }

  const lists: ListHistory[] = CHECKLIST_CATALOGUE.map((entry) => {
    const mine = byTemplate.get(entry.code) ?? [];
    const submitted = mine.filter((r) => r.status === 'SUBMITTED');

    return {
      code: entry.code,
      nameSv: entry.nameSv,
      // One run per list per day, so the number of days is the number expected.
      expected: days,
      started: mine.length,
      signed: submitted.length,
      signedLate: submitted.filter(signedLate).length,
      awaitingControl: submitted.filter((r) => r.controlStatus === 'PENDING').length,
      controlOk: mine.filter((r) => r.controlStatus === 'OK').length,
      controlNotOk: mine.filter((r) => r.controlStatus === 'NOT_OK').length,
      controlFollowUp: mine.filter((r) => r.controlStatus === 'FOLLOW_UP').length,
    };
  });

  const nameByCode = new Map(CHECKLIST_CATALOGUE.map((c) => [c.code, c.nameSv]));

  // Every verdict that was not "approved", newest first. This is the list a
  // group leader actually works from.
  const deviations: Deviation[] = runs
    .filter((r) => r.controlStatus === 'NOT_OK' || r.controlStatus === 'FOLLOW_UP')
    .map((r) => ({
      businessDate: r.businessDate,
      templateCode: r.templateCode,
      nameSv: nameByCode.get(r.templateCode) ?? r.templateCode,
      status: r.controlStatus as Exclude<ControlStatus, 'PENDING' | 'OK'>,
      note: r.controlNote,
      performedByName: r.performedByName,
      controlledByName: r.controlledByName,
    }));

  return {
    from,
    to,
    period,
    days,
    lists,
    deviations,
    totals: {
      started: lists.reduce((n, l) => n + l.started, 0),
      signed: lists.reduce((n, l) => n + l.signed, 0),
      signedLate: lists.reduce((n, l) => n + l.signedLate, 0),
      deviations: deviations.length,
    },
  };
}
