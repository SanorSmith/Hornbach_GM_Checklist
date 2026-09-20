import { beforeEach, describe, expect, it } from 'vitest';
import { CHECKLIST_CATALOGUE, getTemplate } from '@/lib/checklists';
import { repository } from '@/lib/repo';
import { __resetMemoryRepositoryForTests, __resetRunsForTests } from '@/lib/repo/memory';
import { buildSupervisorOverview } from './overview';

/**
 * The group leader's overview is built from the catalogue, not from the runs.
 * A checklist nobody has opened has no run to list, and "nobody started the
 * evening list" is the single thing a supervisor most needs to see.
 */

const DATE = '2026-09-20';
const NOON = new Date('2026-09-20T12:00:00Z');

beforeEach(() => {
  __resetMemoryRepositoryForTests();
  __resetRunsForTests();
});

async function openRunFor(code: string, userId: string) {
  const template = getTemplate(code)!;
  return repository().openRun({
    templateCode: template.code,
    templateVersion: template.version,
    businessDate: DATE,
    shift: template.shift,
    userId,
  });
}

describe('buildSupervisorOverview', () => {
  it('lists every checklist even when nothing has been started', async () => {
    const overview = await buildSupervisorOverview(DATE, NOON);

    expect(overview.checklists).toHaveLength(CHECKLIST_CATALOGUE.length);
    expect(overview.checklists.every((c) => c.status === 'NOT_STARTED')).toBe(true);
    expect(overview.totals.notStarted).toBe(CHECKLIST_CATALOGUE.length);
    expect(overview.totals.signed).toBe(0);
  });

  it('reports a checklist nobody has opened as having no owner', async () => {
    const overview = await buildSupervisorOverview(DATE, NOON);

    const first = overview.checklists[0];
    expect(first?.performedBy).toBeNull();
    expect(first?.runId).toBeNull();
  });

  it('moves a checklist to in progress once someone opens it', async () => {
    const [user] = await repository().listUsers();
    await openRunFor('GM_LF_KVALL', user!.id);

    const overview = await buildSupervisorOverview(DATE, NOON);
    const kvall = overview.checklists.find((c) => c.code === 'GM_LF_KVALL');

    expect(kvall?.status).toBe('IN_PROGRESS');
    expect(kvall?.runId).not.toBeNull();
    expect(overview.totals.notStarted).toBe(CHECKLIST_CATALOGUE.length - 1);
  });

  it('names who is doing it, so the leader knows who to ask', async () => {
    const [user] = await repository().listUsers();
    await openRunFor('GM_LF_MORGON', user!.id);

    const overview = await buildSupervisorOverview(DATE, NOON);
    const morgon = overview.checklists.find((c) => c.code === 'GM_LF_MORGON');

    expect(morgon?.performedBy).toBe(user!.displayName);
  });

  it('leaves the other checklists untouched when one is opened', async () => {
    const [user] = await repository().listUsers();
    await openRunFor('GM_DORR', user!.id);

    const overview = await buildSupervisorOverview(DATE, NOON);

    for (const list of overview.checklists) {
      if (list.code === 'GM_DORR') continue;
      expect(list.status).toBe('NOT_STARTED');
      expect(list.runId).toBeNull();
    }
  });

  it('counts a run opened on another day as not started today', async () => {
    const [user] = await repository().listUsers();
    const template = getTemplate('GM_GPL')!;
    await repository().openRun({
      templateCode: template.code,
      templateVersion: template.version,
      businessDate: '2026-09-19',
      shift: template.shift,
      userId: user!.id,
    });

    const overview = await buildSupervisorOverview(DATE, NOON);

    expect(overview.checklists.find((c) => c.code === 'GM_GPL')?.status).toBe('NOT_STARTED');
  });
});
