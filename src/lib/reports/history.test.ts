import { beforeEach, describe, expect, it } from 'vitest';
import { getTemplate } from '@/lib/checklists';
import { repository } from '@/lib/repo';
import { __resetMemoryRepositoryForTests, __resetRunsForTests } from '@/lib/repo/memory';
import { buildHistoryReport, rangeFor } from './history';

/**
 * Reporting over a period, about lists rather than people.
 *
 * The counts here are what a group leader acts on, so the ones that matter
 * most are the negative ones: unsigned, signed late, and not yet reviewed.
 */

const TODAY = '2026-09-20';

beforeEach(() => {
  __resetMemoryRepositoryForTests();
  __resetRunsForTests();
});

async function runOn(code: string, businessDate: string) {
  const template = getTemplate(code)!;
  const [user] = await repository().listUsers();
  return repository().openRun({
    templateCode: template.code,
    templateVersion: template.version,
    businessDate,
    shift: template.shift,
    userId: user!.id,
  });
}

async function sign(runId: string) {
  const [user] = await repository().listUsers();
  await repository().signRun(runId, {
    slot: 1,
    userId: user!.id,
    username: user!.username,
    displayName: user!.displayName,
    contentHash: 'c',
    signatureHash: 's',
    snapshot: {},
  });
}

describe('rangeFor', () => {
  it('covers seven days inclusive for a week', () => {
    const { from, to, days } = rangeFor('week', TODAY);
    expect(days).toBe(7);
    expect(to).toBe(TODAY);
    expect(from).toBe('2026-09-14');
  });

  it('covers a month and a year', () => {
    expect(rangeFor('month', TODAY).from).toBe('2026-08-22');
    expect(rangeFor('year', TODAY).days).toBe(365);
  });
});

describe('buildHistoryReport', () => {
  it('reports every checklist even when none were done', async () => {
    const report = await buildHistoryReport('week', TODAY);

    expect(report.lists).toHaveLength(4);
    expect(report.totals.started).toBe(0);
    expect(report.deviations).toEqual([]);
  });

  it('counts runs inside the period and ignores older ones', async () => {
    await runOn('GM_LF_KVALL', TODAY);
    await runOn('GM_LF_KVALL', '2026-09-15');
    // Two weeks back: inside the month, outside the week.
    await runOn('GM_LF_KVALL', '2026-09-06');

    const week = await buildHistoryReport('week', TODAY);
    const month = await buildHistoryReport('month', TODAY);

    expect(week.lists.find((l) => l.code === 'GM_LF_KVALL')?.started).toBe(2);
    expect(month.lists.find((l) => l.code === 'GM_LF_KVALL')?.started).toBe(3);
  });

  it('separates started from signed', async () => {
    const open = await runOn('GM_DORR', TODAY);
    const done = await runOn('GM_GPL', TODAY);
    await sign(done.id);

    const report = await buildHistoryReport('week', TODAY);

    expect(report.lists.find((l) => l.code === 'GM_DORR')?.signed).toBe(0);
    expect(report.lists.find((l) => l.code === 'GM_GPL')?.signed).toBe(1);
    expect(open.status).toBe('OPEN');
  });

  it('counts a signed but unreviewed list as awaiting control', async () => {
    const run = await runOn('GM_GPL', TODAY);
    await sign(run.id);

    const report = await buildHistoryReport('week', TODAY);
    expect(report.lists.find((l) => l.code === 'GM_GPL')?.awaitingControl).toBe(1);
  });

  it('lists every deviation with its note, newest first', async () => {
    const older = await runOn('GM_GPL', '2026-09-16');
    const newer = await runOn('GM_DORR', TODAY);
    await sign(older.id);
    await sign(newer.id);

    for (const [id, note] of [
      [older.id, 'FiFo:n var inte justerad.'],
      [newer.id, 'Lastkajen var inte tömd.'],
    ] as const) {
      await repository().controlRun(id, {
        status: 'NOT_OK',
        note,
        userId: 'leader',
        username: 'erik',
        displayName: 'Erik Andersson',
        contentHash: 'c',
        signatureHash: 's',
        snapshot: {},
      });
    }

    const report = await buildHistoryReport('week', TODAY);

    expect(report.deviations).toHaveLength(2);
    expect(report.deviations[0]?.businessDate).toBe(TODAY);
    expect(report.deviations[0]?.note).toBe('Lastkajen var inte tömd.');
    expect(report.totals.deviations).toBe(2);
  });

  it('leaves approved lists out of the deviations', async () => {
    const run = await runOn('GM_GPL', TODAY);
    await sign(run.id);
    await repository().controlRun(run.id, {
      status: 'OK',
      note: null,
      userId: 'leader',
      username: 'erik',
      displayName: 'Erik Andersson',
      contentHash: 'c',
      signatureHash: 's',
      snapshot: {},
    });

    const report = await buildHistoryReport('week', TODAY);

    expect(report.deviations).toEqual([]);
    expect(report.lists.find((l) => l.code === 'GM_GPL')?.controlOk).toBe(1);
  });

  it('names who did it and who reviewed it, for following up', async () => {
    const [user] = await repository().listUsers();
    const run = await runOn('GM_DORR', TODAY);
    await sign(run.id);
    await repository().controlRun(run.id, {
      status: 'FOLLOW_UP',
      note: 'Kolla imorgon.',
      userId: 'leader',
      username: 'erik',
      displayName: 'Erik Andersson',
      contentHash: 'c',
      signatureHash: 's',
      snapshot: {},
    });

    const [deviation] = (await buildHistoryReport('week', TODAY)).deviations;

    expect(deviation?.performedByName).toBe(user!.displayName);
    expect(deviation?.controlledByName).toBe('Erik Andersson');
    expect(deviation?.status).toBe('FOLLOW_UP');
  });
});
