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

  'login.title': 'Sign in',
  'login.subtitle': 'Use your username and PIN.',
  'login.username': 'Username',
  'login.pin': 'PIN',
  'login.submit': 'Sign in',
  'login.signingIn': 'Signing in…',
  'login.clear': 'Clear',
  'login.badCredentials': 'Wrong username or PIN.',
  'login.locked': 'Account locked after too many attempts. Try again in {minutes} minutes.',
  'login.invalidInput': 'Enter a username and a PIN of 4–8 digits.',
  'login.inactive': 'This account is disabled. Contact your group leader.',
  'login.failed': 'Sign-in failed. Please try again.',
  'login.demoHeading': 'Demo accounts',
  'login.demoBody': 'The system is running in demo mode, so these sign-ins are open on purpose.',

  'demo.banner': 'DEMO MODE — nothing is saved. Do not use for real checklists.',

  'nav.logout': 'Sign out',
  'nav.signedInAs': 'Signed in as',

  'idle.warningTitle': 'Still there?',
  'idle.warningBody': 'You will be signed out automatically in {seconds} seconds.',
  'idle.stay': "I'm still here",

  'role.worker': 'Staff',
  'role.groupLeader': 'Group leader',
  'role.admin': 'Administrator',

  'admin.title': 'Administration',
  'admin.users': 'Users',
  'admin.newUser': 'New user',
  'admin.username': 'Username',
  'admin.displayName': 'Name',
  'admin.roles': 'Permissions',
  'admin.create': 'Create account',
  'admin.pinTitle': 'PIN for {name}',
  'admin.pinOnce': 'Shown once only. Write it down and hand it to the person.',
  'admin.resetPin': 'New PIN',
  'admin.deactivate': 'Deactivate',
  'admin.activate': 'Activate',
  'admin.active': 'Active',
  'admin.inactive': 'Inactive',
  'admin.locked': 'Locked',
  'admin.saving': 'Saving…',
  'admin.done': 'Done',
  'admin.noUsers': 'No users yet.',

  'gpl.title': "Today's overview",
  'gpl.notStarted': 'Not started',
  'gpl.inProgress': 'In progress',
  'gpl.readyToSign': 'Ready to sign',
  'gpl.signed': 'Signed',
  'gpl.late': 'Overdue',
  'gpl.performedBy': 'Performed by',
  'gpl.signedBy': 'Signed by',
  'gpl.nobodyStarted': 'Nobody has started yet',
  'gpl.answeredOf': '{answered} of {total} answered',
  'gpl.blocked': '{count} left to resolve',
  'gpl.overdueItems': '{count} overdue',
  'gpl.open': 'Open the list',
  'gpl.allDone': 'Every list is signed.',
  'gpl.summary': '{notStarted} not started · {inProgress} in progress · {signed} signed',

  'control.title': 'After-control',
  'control.pending': 'Awaiting after-control',
  'control.ok': 'Approved',
  'control.notOk': 'Deviation',
  'control.followUp': 'Follow up',
  'control.by': 'Reviewed by',
  'control.notePlaceholder': 'What is wrong, or what needs following up?',
  'control.noteRequired': 'Write what is wrong or needs following up.',
  'control.saving': 'Saving…',
  'control.awaiting': '{count} awaiting after-control',

  'assign.label': 'Assigned to',
  'assign.nobody': 'Nobody assigned',
  'assign.choose': 'Choose a person…',
  'assign.saving': 'Saving…',
  'assign.unstarted': '{count} assigned but not started',
  'assign.notAssigned': 'Not assigned to anyone',
  'assign.mine': 'Your lists today',
  'assign.doneBySomeoneElse': 'Being done by someone other than the assignee',

  'notif.title': 'Needs attention',
  'notif.notStarted': '{list} has not been started',
  'notif.notSigned': '{list} has not been signed',
  'notif.assignee': 'Assigned to {name}',
  'notif.dismiss': 'Got it',

  'push.enable': 'Turn on notifications',
  'push.turnOff': 'Turn off notifications',
  'push.working': 'One moment…',
  'push.denied': 'Notifications are blocked in the browser',
  'push.unsupported': 'This device does not support notifications',
  'push.failed': 'Could not turn notifications on.',
};
