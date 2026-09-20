import { beforeEach, describe, expect, it } from 'vitest';
import { getTemplate } from '@/lib/checklists';
import { repository } from '@/lib/repo';
import { __resetMemoryRepositoryForTests, __resetRunsForTests } from '@/lib/repo/memory';
import { buildHistoryReport } from './history';
import { buildPeopleReport } from './people';

/**
 * Every figure here lands against a named employee, so the tests that matter
 * most are the ones about attribution: who gets counted for what, and who does
 * not get counted for someone else's work.
 */

const TODAY = '2026-09-20';

beforeEach(() => {
  __resetMemoryRepositoryForTests();
  __resetRunsForTests();
});

async function people() {
  return repository().listUsers();
}

async function openRun(code: string, userId: string, businessDate = TODAY) {
  const template = getTemplate(code)!;
  return repository().openRun({
    templateCode: template.code,
    templateVersion: template.version,
    businessDate,
    shift: template.shift,
    userId,
  });
}

async function signAs(
  runId: string,
  user: { id: string; username: string; displayName: string },
  slot = 1,
) {
  await repository().signRun(runId, {
    slot,
    userId: user.id,
    username: user.username,
    displayName: user.displayName,
    contentHash: 'c',
    signatureHash: 's',
    snapshot: {},
  });
}

describe('buildPeopleReport', () => {
  it('lists every active person, including those with nothing against them', async () => {
    const report = await buildPeopleReport('week', TODAY);

    expect(report.people.length).toBeGreaterThan(0);
    expect(report.people.every((p) => p.signed === 0)).toBe(true);
  });

  it('credits the signature to whoever signed, not whoever opened', async () => {
    const [anna, erik] = await people();
    const run = await openRun('GM_GPL', anna!.id);
    // Anna started it; Erik finished and signed it.
    await signAs(run.id, erik!);

    const report = await buildPeopleReport('week', TODAY);
    const forAnna = report.people.find((p) => p.userId === anna!.id);
    const forErik = report.people.find((p) => p.userId === erik!.id);

    expect(forAnna?.opened).toBe(1);
    expect(forAnna?.signed).toBe(0);
    expect(forErik?.signed).toBe(1);
    expect(forErik?.opened).toBe(0);
  });

  it('counts an after-control deviation against the signer', async () => {
    const [anna] = await people();
    const run = await openRun('GM_GPL', anna!.id);
    await signAs(run.id, anna!);
    await repository().controlRun(run.id, {
      status: 'NOT_OK',
      note: 'FiFo:n var inte justerad.',
      userId: 'leader',
      username: 'erik',
      displayName: 'Erik Andersson',
      contentHash: 'c',
      signatureHash: 's',
      snapshot: {},
    });

    const report = await buildPeopleReport('week', TODAY);
    expect(report.people.find((p) => p.userId === anna!.id)?.deviations).toBe(1);
  });

  it('counts an approved review separately from a deviation', async () => {
    const [anna] = await people();
    const run = await openRun('GM_DORR', anna!.id);
    await signAs(run.id, anna!);
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

    const forAnna = (await buildPeopleReport('week', TODAY)).people.find(
      (p) => p.userId === anna!.id,
    );
    expect(forAnna?.controlOk).toBe(1);
    expect(forAnna?.deviations).toBe(0);
  });

  it('counts an assignment as outstanding only if nobody signed the list', async () => {
    const [anna, erik] = await people();
    await repository().setAssignment({
      businessDate: TODAY,
      templateCode: 'GM_GPL',
      slot: 1,
      assignedTo: anna!.id,
      assignedBy: 'leader',
    });

    // Erik did it instead. The work happened, so it is not outstanding.
    const run = await openRun('GM_GPL', erik!.id);
    await signAs(run.id, erik!);

    const forAnna = (await buildPeopleReport('week', TODAY)).people.find(
      (p) => p.userId === anna!.id,
    );
    expect(forAnna?.assigned).toBe(1);
    expect(forAnna?.assignedNotSigned).toBe(0);
  });

  it('counts an assignment nobody did as outstanding', async () => {
    const [anna] = await people();
    await repository().setAssignment({
      businessDate: TODAY,
      templateCode: 'GM_LF_KVALL',
      slot: 1,
      assignedTo: anna!.id,
      assignedBy: 'leader',
    });

    const forAnna = (await buildPeopleReport('week', TODAY)).people.find(
      (p) => p.userId === anna!.id,
    );
    expect(forAnna?.assigned).toBe(1);
    expect(forAnna?.assignedNotSigned).toBe(1);
  });

  it('credits both signers of a two-slot list, once each', async () => {
    // GM_LF_KVALL has two assignee slots: person 1 and person 2 each sign for
    // their own half, and both of them did the work.
    const [anna, erik] = await people();
    const run = await openRun('GM_LF_KVALL', anna!.id);
    await signAs(run.id, anna!, 1);
    await signAs(run.id, erik!, 2);

    const report = await buildPeopleReport('week', TODAY);

    expect(report.people.find((p) => p.userId === anna!.id)?.signed).toBe(1);
    expect(report.people.find((p) => p.userId === erik!.id)?.signed).toBe(1);
  });

  it('does not double-count a two-slot list in the per-list history', async () => {
    const [anna, erik] = await people();
    const run = await openRun('GM_LF_KVALL', anna!.id);
    await signAs(run.id, anna!, 1);
    await signAs(run.id, erik!, 2);

    const history = await buildHistoryReport('week', TODAY);
    const list = history.lists.find((l) => l.code === 'GM_LF_KVALL');

    expect(list?.started).toBe(1);
    expect(list?.signed).toBe(1);
  });

  it('does not count work from outside the period', async () => {
    const [anna] = await people();
    const old = await openRun('GM_GPL', anna!.id, '2026-09-01');
    await signAs(old.id, anna!);

    const week = await buildPeopleReport('week', TODAY);
    const month = await buildPeopleReport('month', TODAY);

    expect(week.people.find((p) => p.userId === anna!.id)?.signed).toBe(0);
    expect(month.people.find((p) => p.userId === anna!.id)?.signed).toBe(1);
  });
});
