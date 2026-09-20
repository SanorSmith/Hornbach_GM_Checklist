import { beforeEach, describe, expect, it } from 'vitest';
import { getTemplate } from '@/lib/checklists';
import { repository } from '@/lib/repo';
import { __resetMemoryRepositoryForTests, __resetRunsForTests } from '@/lib/repo/memory';
import { buildSupervisorOverview } from './overview';

/**
 * Efterkontroll: the group leader's review of a finished list.
 *
 * The review is a signature with purpose 'LEADER_CONTROL', not a status field,
 * so it is as tamper-evident as the work it reviews — and so it must not
 * collide with the worker's own signature.
 */

const DATE = '2026-09-20';
const NOON = new Date('2026-09-20T12:00:00Z');

beforeEach(() => {
  __resetMemoryRepositoryForTests();
  __resetRunsForTests();
});

async function submittedRun(code = 'GM_LF_KVALL') {
  const template = getTemplate(code)!;
  const [user] = await repository().listUsers();
  const run = await repository().openRun({
    templateCode: template.code,
    templateVersion: template.version,
    businessDate: DATE,
    shift: template.shift,
    userId: user!.id,
  });
  await repository().signRun(run.id, {
    slot: 1,
    userId: user!.id,
    username: user!.username,
    displayName: user!.displayName,
    contentHash: 'content',
    signatureHash: 'sig',
    snapshot: {},
  });
  return run;
}

function control(runId: string, status: 'OK' | 'NOT_OK' | 'FOLLOW_UP', note: string | null = null) {
  return repository().controlRun(runId, {
    status,
    note,
    userId: 'leader-id',
    username: 'erik',
    displayName: 'Erik Andersson',
    contentHash: 'content',
    signatureHash: 'control-sig',
    snapshot: {},
  });
}

describe('controlRun', () => {
  it('records the verdict and who gave it', async () => {
    const run = await submittedRun();

    await control(run.id, 'OK');

    const after = await repository().getRun(run.id);
    expect(after?.control.status).toBe('OK');
    expect(after?.control.by).toBe('Erik Andersson');
    expect(after?.control.at).not.toBeNull();
  });

  it('keeps the note with the verdict', async () => {
    const run = await submittedRun();

    await control(run.id, 'NOT_OK', 'Containern var inte tömd.');

    const after = await repository().getRun(run.id);
    expect(after?.control.note).toBe('Containern var inte tömd.');
  });

  it('adds a control signature without disturbing the worker signature', async () => {
    const run = await submittedRun();

    await control(run.id, 'OK');

    const after = await repository().getRun(run.id);
    const purposes = after?.signatures.map((s) => s.purpose).sort();
    expect(purposes).toEqual(['LEADER_CONTROL', 'WORKER_SUBMIT']);
  });

  it('refuses a second review', async () => {
    const run = await submittedRun();
    await control(run.id, 'OK');

    await expect(control(run.id, 'NOT_OK', 'ångrade mig')).rejects.toThrow();
  });

  it('refuses to review a list that is not submitted', async () => {
    const template = getTemplate('GM_DORR')!;
    const [user] = await repository().listUsers();
    const run = await repository().openRun({
      templateCode: template.code,
      templateVersion: template.version,
      businessDate: DATE,
      shift: template.shift,
      userId: user!.id,
    });

    await expect(control(run.id, 'OK')).rejects.toThrow();
  });
});

describe('the supervisor overview', () => {
  it('counts a signed but unreviewed list as awaiting control', async () => {
    await submittedRun();

    const overview = await buildSupervisorOverview(DATE, NOON);
    expect(overview.totals.awaitingControl).toBe(1);
  });

  it('stops counting it once reviewed', async () => {
    const run = await submittedRun();
    await control(run.id, 'OK');

    const overview = await buildSupervisorOverview(DATE, NOON);
    expect(overview.totals.awaitingControl).toBe(0);
    expect(
      overview.checklists.find((c) => c.code === 'GM_LF_KVALL')?.control.status,
    ).toBe('OK');
  });

  it('still names the worker as the signer, not the reviewer', async () => {
    const run = await submittedRun();
    const [user] = await repository().listUsers();
    await control(run.id, 'OK');

    const overview = await buildSupervisorOverview(DATE, NOON);
    const list = overview.checklists.find((c) => c.code === 'GM_LF_KVALL');

    expect(list?.signedBy).toBe(user!.displayName);
    expect(list?.control.by).toBe('Erik Andersson');
  });
});
