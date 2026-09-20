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

  'login.title': 'Logga in',
  'login.subtitle': 'Använd ditt användarnamn och din PIN-kod.',
  'login.username': 'Användarnamn',
  'login.pin': 'PIN-kod',
  'login.submit': 'Logga in',
  'login.signingIn': 'Loggar in…',
  'login.clear': 'Rensa',
  'login.badCredentials': 'Fel användarnamn eller PIN-kod.',
  'login.locked': 'Kontot är låst efter för många försök. Försök igen om {minutes} minuter.',
  'login.invalidInput': 'Fyll i användarnamn och en PIN-kod med 4–8 siffror.',
  'login.inactive': 'Kontot är inaktiverat. Kontakta din gruppledare.',
  'login.failed': 'Inloggningen misslyckades. Försök igen.',
  'login.demoHeading': 'Demokonton',
  'login.demoBody': 'Systemet körs i demoläge, så inloggningarna nedan är öppna med flit.',

  'demo.banner': 'DEMOLÄGE – ingenting sparas. Använd inte för riktiga checklistor.',

  'nav.logout': 'Logga ut',
  'nav.signedInAs': 'Inloggad som',

  'idle.warningTitle': 'Är du kvar?',
  'idle.warningBody': 'Du loggas ut automatiskt om {seconds} sekunder.',
  'idle.stay': 'Jag är kvar',

  'role.worker': 'Medarbetare',
  'role.groupLeader': 'Gruppledare',
  'role.admin': 'Administratör',

  'admin.title': 'Administration',
  'admin.users': 'Användare',
  'admin.newUser': 'Ny användare',
  'admin.username': 'Användarnamn',
  'admin.displayName': 'Namn',
  'admin.roles': 'Behörigheter',
  'admin.create': 'Skapa konto',
  'admin.pinTitle': 'PIN-kod för {name}',
  'admin.pinOnce': 'Visas bara en gång. Skriv ner den och ge den till personen.',
  'admin.resetPin': 'Ny PIN',
  'admin.deactivate': 'Inaktivera',
  'admin.activate': 'Aktivera',
  'admin.active': 'Aktiv',
  'admin.inactive': 'Inaktiv',
  'admin.locked': 'Låst',
  'admin.saving': 'Sparar…',
  'admin.done': 'Klart',
  'admin.noUsers': 'Inga användare ännu.',

  'gpl.title': 'Översikt för dagen',
  'gpl.notStarted': 'Ej påbörjad',
  'gpl.inProgress': 'Pågår',
  'gpl.readyToSign': 'Klar att signera',
  'gpl.signed': 'Signerad',
  'gpl.late': 'Försenad',
  'gpl.performedBy': 'Genomförs av',
  'gpl.signedBy': 'Signerad av',
  'gpl.nobodyStarted': 'Ingen har börjat än',
  'gpl.answeredOf': '{answered} av {total} besvarade',
  'gpl.blocked': '{count} kvar att åtgärda',
  'gpl.overdueItems': '{count} över tid',
  'gpl.open': 'Öppna listan',
  'gpl.allDone': 'Alla listor är signerade.',
  'gpl.summary': '{notStarted} ej påbörjade · {inProgress} pågår · {signed} signerade',

  'control.title': 'Efterkontroll',
  'control.pending': 'Väntar på efterkontroll',
  'control.ok': 'Godkänd',
  'control.notOk': 'Avvikelse',
  'control.followUp': 'Uppföljning',
  'control.by': 'Kontrollerad av',
  'control.notePlaceholder': 'Vad är fel eller ska följas upp?',
  'control.noteRequired': 'Skriv vad som är fel eller ska följas upp.',
  'control.saving': 'Sparar…',
  'control.awaiting': '{count} väntar på efterkontroll',
} as const;

export type MessageKey = keyof typeof sv;
