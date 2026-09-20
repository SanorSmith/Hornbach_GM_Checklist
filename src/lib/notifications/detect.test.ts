import { describe, expect, it } from 'vitest';
import { detectOverdue, type ChecklistTiming } from './detect';

/**
 * The thing worth being told about is an absence — nobody started the evening
 * list. Nothing happens to trigger that, so the rules here are all comparisons
 * against the clock, and `now` is always supplied rather than read.
 */

/** The evening list's first deadline, not the start of the evening shift. */
const FIRST_DUE = new Date('2026-09-20T17:00:00Z');
const END = new Date('2026-09-20T19:45:00Z');
const LEADERS = ['leader-1'];

function list(overrides: Partial<ChecklistTiming> = {}): ChecklistTiming {
  return {
    code: 'GM_LF_KVALL',
    nameSv: 'Checklista GM Linefeeder KVÄLL',
    status: 'NOT_STARTED',
    assignedTo: { id: 'anna', name: 'Anna Lindqvist' },
    notStartedDueAt: FIRST_DUE,
    endAt: END,
    ...overrides,
  };
}

const at = (minutesFromFirstDue: number) =>
  new Date(FIRST_DUE.getTime() + minutesFromFirstDue * 60_000);

describe('detectOverdue', () => {
  it('says nothing before the first point falls due', () => {
    const found = detectOverdue({
      now: at(-1),
      checklists: [list()],
      supervisorIds: LEADERS,
    });
    expect(found).toEqual([]);
  });

  it('raises an unstarted list once its first point is due', () => {
    const found = detectOverdue({
      now: at(1),
      checklists: [list()],
      supervisorIds: LEADERS,
    });
    expect(found.map((f) => f.kind)).toEqual(['ASSIGNED_NOT_STARTED', 'ASSIGNED_NOT_STARTED']);
  });

  it('tells the assignee and the supervisor, each once', () => {
    const found = detectOverdue({
      now: at(1),
      checklists: [list()],
      supervisorIds: LEADERS,
    });
    expect(new Set(found.map((f) => f.recipientId))).toEqual(new Set(['anna', 'leader-1']));
  });

  it('does not tell a supervisor twice when they are also the assignee', () => {
    const found = detectOverdue({
      now: at(1),
      checklists: [list({ assignedTo: { id: 'leader-1', name: 'Erik' } })],
      supervisorIds: LEADERS,
    });
    expect(found).toHaveLength(1);
  });

  it('still tells the supervisor about an unassigned list', () => {
    const found = detectOverdue({
      now: at(1),
      checklists: [list({ assignedTo: null })],
      supervisorIds: LEADERS,
    });
    expect(found.map((f) => f.recipientId)).toEqual(['leader-1']);
    expect(found[0]?.payload.assigneeName).toBeNull();
  });

  it('raises only the more serious kind once the shift has ended', () => {
    const found = detectOverdue({
      now: new Date(END.getTime() + 60_000),
      checklists: [list()],
      supervisorIds: LEADERS,
    });
    // Untouched after the end is both unstarted and unsigned; reporting both
    // would tell everyone the same thing twice.
    expect(new Set(found.map((f) => f.kind))).toEqual(new Set(['NOT_SIGNED_BY_END']));
  });

  it('raises an in-progress list that was never signed', () => {
    const found = detectOverdue({
      now: new Date(END.getTime() + 60_000),
      checklists: [list({ status: 'IN_PROGRESS' })],
      supervisorIds: LEADERS,
    });
    expect(found.map((f) => f.kind)).toContain('NOT_SIGNED_BY_END');
  });

  it('says nothing about a signed list, however late', () => {
    const found = detectOverdue({
      now: new Date(END.getTime() + 60 * 60_000),
      checklists: [list({ status: 'SIGNED' })],
      supervisorIds: LEADERS,
    });
    expect(found).toEqual([]);
  });

  it('does not raise an in-progress list before the shift ends', () => {
    const found = detectOverdue({
      now: at(1),
      checklists: [list({ status: 'IN_PROGRESS' })],
      supervisorIds: LEADERS,
    });
    // Someone is working on it and the shift is not over. That is just work.
    expect(found).toEqual([]);
  });

  it('carries the list name and the time it was due, for the message', () => {
    const [first] = detectOverdue({
      now: new Date(END.getTime() + 60_000),
      checklists: [list()],
      supervisorIds: LEADERS,
    });
    expect(first?.payload.listName).toBe('Checklista GM Linefeeder KVÄLL');
    expect(first?.payload.dueAt).toBe(END.toISOString());
    expect(first?.payload.assigneeName).toBe('Anna Lindqvist');
  });
});
