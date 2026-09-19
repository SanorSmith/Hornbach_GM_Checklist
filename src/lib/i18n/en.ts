import type { MessageKey } from './sv';

/**
 * Typed as a complete record of the Swedish keys, so adding a key to `sv.ts`
 * without translating it here is a compile error rather than a silent gap.
 */
export const en: Record<MessageKey, string> = {
  'app.name': 'GM Checklist',
  'app.tagline': 'Digital checklists for Goods Reception',

  'nav.myLists': 'My lists',
  'nav.leader': 'Group leader',
  'nav.reports': 'Reports',
  'nav.admin': 'Administration',

  'worker.pickList': 'Which lists are you doing today?',
  'worker.start': 'Start',
  'worker.continue': 'Continue',
  'worker.sign': 'Sign the list',

  'answer.ja': 'Yes',
  'answer.nej': 'No',
  'answer.ingetBehov': 'Not needed',
  'answer.note': 'Note',

  'item.blocked': 'Locked until the previous point is answered',
  'item.dueAt': 'Due by',
  'item.overdue': 'Overdue',
  'item.photoRequired': 'Photo required',

  'note.whyNot': 'Write why you did not manage it — not "no time".',

  'leader.afterControl': 'After-control',
  'leader.comment': 'Comment',
  'leader.ok': 'Approved',
  'leader.notOk': 'Not approved',

  'status.offline': 'Offline — answers are saved and sent when the network returns',
  'status.unsynced': 'Unsynced answers',

  'shift.morning': 'Morning',
  'shift.midday': 'Midday',
  'shift.evening': 'Evening',
  'shift.fullDay': 'Full day',

  'phase.scaffold': 'The foundation is in place. The checklists are seeded in the next step.',
};
