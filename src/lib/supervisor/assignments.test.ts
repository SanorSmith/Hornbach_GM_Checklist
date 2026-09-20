import { beforeEach, describe, expect, it } from 'vitest';
import { getTemplate } from '@/lib/checklists';
import { repository } from '@/lib/repo';
import { __resetMemoryRepositoryForTests, __resetRunsForTests } from '@/lib/repo/memory';
import { buildSupervisorOverview } from './overview';

/**
 * Assignment answers "who was meant to do this", which is a different question
 * from "who did", and the one a supervisor needs before the work starts. An
 * assignment therefore exists without a run — there is nothing to attach to
 * until someone opens the list.
 */

const DATE = '2026-09-20';
const NOON = new Date('2026-09-20T12:00:00Z');

beforeEach(() => {
  __resetMemoryRepositoryForTests();
  __resetRunsForTests();
});

async function users() {
  return repository().listUsers();
}

function assign(templateCode: string, assignedTo: string, slot = 1) {
  return repository().setAssignment({
    businessDate: DATE,
    templateCode,
    slot,
    assignedTo,
    assignedBy: 'leader-id',
  });
}

describe('setAssignment', () => {
  it('records who is expected to do a list, before any run exists', async () => {
    const [anna] = await users();
    await assign('GM_LF_KVALL', anna!.id);

    const overview = await buildSupervisorOverview(DATE, NOON);
    const kvall = overview.checklists.find((c) => c.code === 'GM_LF_KVALL');

    expect(kvall?.status).toBe('NOT_STARTED');
    expect(kvall?.assignedTo?.name).toBe(anna!.displayName);
  });

  it('replaces rather than stacks, so a list has one owner', async () => {
    const [anna, erik] = await users();
    await assign('GM_DORR', anna!.id);
    await assign('GM_DORR', erik!.id);

    const listed = await repository().listAssignments(DATE);
    const forDoor = listed.filter((a) => a.templateCode === 'GM_DORR');

    expect(forDoor).toHaveLength(1);
    expect(forDoor[0]?.assignedTo).toBe(erik!.id);
  });

  it('keeps slot 2 separate, for the evening list Person 2', async () => {
    const [anna, erik] = await users();
    await assign('GM_LF_KVALL', anna!.id, 1);
    await assign('GM_LF_KVALL', erik!.id, 2);

    const listed = (await repository().listAssignments(DATE)).filter(
      (a) => a.templateCode === 'GM_LF_KVALL',
    );
    expect(listed).toHaveLength(2);
    expect(listed.find((a) => a.slot === 2)?.assignedTo).toBe(erik!.id);
  });

  it('does not leak into another day', async () => {
    const [anna] = await users();
    await assign('GM_GPL', anna!.id);

    expect(await repository().listAssignments('2026-09-21')).toHaveLength(0);
  });
});

describe('clearAssignment', () => {
  it('leaves the checklist in place, just unassigned', async () => {
    const [anna] = await users();
    await assign('GM_LF_MORGON', anna!.id);
    await repository().clearAssignment({
      businessDate: DATE,
      templateCode: 'GM_LF_MORGON',
      slot: 1,
    });

    const overview = await buildSupervisorOverview(DATE, NOON);
    const morgon = overview.checklists.find((c) => c.code === 'GM_LF_MORGON');

    expect(morgon).toBeDefined();
    expect(morgon?.assignedTo).toBeNull();
  });
});

describe('the supervisor overview', () => {
  it('counts assigned lists nobody has started — the ones worth chasing', async () => {
    const [anna] = await users();
    await assign('GM_LF_KVALL', anna!.id);

    const overview = await buildSupervisorOverview(DATE, NOON);
    expect(overview.totals.unstartedButAssigned).toBe(1);
  });

  it('stops counting once the assignee starts it', async () => {
    const [anna] = await users();
    const template = getTemplate('GM_LF_KVALL')!;
    await assign('GM_LF_KVALL', anna!.id);
    await repository().openRun({
      templateCode: template.code,
      templateVersion: template.version,
      businessDate: DATE,
      shift: template.shift,
      userId: anna!.id,
    });

    const overview = await buildSupervisorOverview(DATE, NOON);
    expect(overview.totals.unstartedButAssigned).toBe(0);
  });

  it('does not count an unassigned list as needing chasing', async () => {
    const overview = await buildSupervisorOverview(DATE, NOON);
    expect(overview.totals.unstartedButAssigned).toBe(0);
    expect(overview.totals.notStarted).toBeGreaterThan(0);
  });

  it('keeps assignment and performer distinct when someone else does it', async () => {
    const [anna, erik] = await users();
    const template = getTemplate('GM_DORR')!;
    await assign('GM_DORR', anna!.id);
    await repository().openRun({
      templateCode: template.code,
      templateVersion: template.version,
      businessDate: DATE,
      shift: template.shift,
      userId: erik!.id,
    });

    const overview = await buildSupervisorOverview(DATE, NOON);
    const door = overview.checklists.find((c) => c.code === 'GM_DORR');

    expect(door?.assignedTo?.name).toBe(anna!.displayName);
    expect(door?.performedBy).toBe(erik!.displayName);
  });
});
