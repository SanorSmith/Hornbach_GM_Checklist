/**
 * Swedish is the source of truth: the checklists are written in Swedish and a
 * translation that shifts a rule's meaning is a safety problem, not a typo.
 * Add keys here first; `en.ts` is typed against this object so it cannot drift.
 */
export const sv = {
  'app.name': 'GM Checklista',
  'app.tagline': 'Digitala checklistor för Godsmottagningen',

  'nav.myLists': 'Mina listor',
  'nav.leader': 'Gruppledare',
  'nav.reports': 'Rapporter',
  'nav.admin': 'Administration',

  'worker.pickList': 'Vilka listor ska du göra idag?',
  'worker.start': 'Starta',
  'worker.continue': 'Fortsätt',
  'worker.sign': 'Signera listan',

  'answer.ja': 'Ja',
  'answer.nej': 'Nej',
  'answer.ingetBehov': 'Inget behov',
  'answer.note': 'Anteckning',

  'item.blocked': 'Låst tills föregående punkt är besvarad',
  'item.dueAt': 'Senast',
  'item.overdue': 'Försenad',
  'item.photoRequired': 'Bild krävs',

  'note.whyNot': 'Skriv varför ni inte hann – inte «hinner inte».',

  'leader.afterControl': 'Efterkontroll',
  'leader.comment': 'Kommentar',
  'leader.ok': 'Godkänd',
  'leader.notOk': 'Ej godkänd',

  'status.offline': 'Offline – svaren sparas och skickas när nätet är tillbaka',
  'status.unsynced': 'Osynkade svar',

  'shift.morning': 'Morgon',
  'shift.midday': 'Mellanpass',
  'shift.evening': 'Kväll',
  'shift.fullDay': 'Heldag',

  'phase.scaffold': 'Grundstommen är på plats. Checklistorna läggs in i nästa steg.',
} as const;

export type MessageKey = keyof typeof sv;
