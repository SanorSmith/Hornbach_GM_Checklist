import type { RunStatus } from '@/lib/supervisor/overview';

/**
 * Works out who should be told that a list is late.
 *
 * Pure, and takes `now` as an argument: everything here is a comparison against
 * the clock, and a function that reads it cannot be tested against a specific
 * evening.
 */

export type NotificationKind = 'ASSIGNED_NOT_STARTED' | 'NOT_SIGNED_BY_END';

/**
 * Fallback grace after a shift opens, for a list with no deadlines of its own.
 *
 * Telling someone at 06:00:01 that they have not started their 06:00 list is
 * noise, and noise is how people learn to ignore the thing.
 */
export const NOT_STARTED_GRACE_MINUTES = 60;

export interface ChecklistTiming {
  code: string;
  nameSv: string;
  status: RunStatus;
  /** Who was meant to do it, if anyone. */
  assignedTo: { id: string; name: string } | null;
  /**
   * When an untouched list becomes worth mentioning — the first point that
   * falls due, not the start of the shift.
   *
   * The evening linefeeder is on shift from 13:00 but nothing on their list is
   * due until 17:00. Anchoring on the shift would report it late for four
   * hours while the person is doing exactly what was asked of them.
   */
  notStartedDueAt: Date;
  /** When an unsigned list becomes worth mentioning: the end of the shift. */
  endAt: Date;
}

export interface PendingNotification {
  templateCode: string;
  slot: number;
  recipientId: string;
  kind: NotificationKind;
  payload: {
    listName: string;
    dueAt: string;
    assigneeName: string | null;
  };
}

export interface DetectInput {
  now: Date;
  checklists: readonly ChecklistTiming[];
  /** Group leaders and admins, who are told about every late list. */
  supervisorIds: readonly string[];
}

export function detectOverdue({ now, checklists, supervisorIds }: DetectInput): PendingNotification[] {
  const pending: PendingNotification[] = [];

  for (const list of checklists) {
    if (list.status === 'SIGNED') continue;

    const pastEnd = now.getTime() > list.endAt.getTime();
    const pastFirstDeadline = now.getTime() > list.notStartedDueAt.getTime();

    // The two conditions overlap after the shift ends — an untouched list is
    // both unstarted and unsigned. Only the more serious one is raised, or
    // every late list would be reported twice.
    let kind: NotificationKind | null = null;
    let dueAt: Date | null = null;

    if (pastEnd) {
      kind = 'NOT_SIGNED_BY_END';
      dueAt = list.endAt;
    } else if (pastFirstDeadline && list.status === 'NOT_STARTED') {
      kind = 'ASSIGNED_NOT_STARTED';
      dueAt = list.notStartedDueAt;
    }

    if (!kind || !dueAt) continue;

    const payload = {
      listName: list.nameSv,
      dueAt: dueAt.toISOString(),
      assigneeName: list.assignedTo?.name ?? null,
    };

    // The person who was meant to do it, plus everyone responsible for it
    // getting done. A supervisor who is also the assignee is told once.
    const recipients = new Set<string>(supervisorIds);
    if (list.assignedTo) recipients.add(list.assignedTo.id);

    for (const recipientId of recipients) {
      pending.push({
        templateCode: list.code,
        slot: 1,
        recipientId,
        kind,
        payload,
      });
    }
  }

  return pending;
}
