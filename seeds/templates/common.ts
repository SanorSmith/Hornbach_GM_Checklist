import type { GmRulesInput } from '@/lib/rules/schema';

/**
 * Rules every list inherits.
 *
 * The footer of every paper form says: OBS! Om nej, Skriv ej! "hinner inte",
 * skriv bara varför ni hann inte. Encoding it once here means it applies to
 * every point on every list, which is exactly what the printed instruction
 * means — and it is the rule that turns a shrug into an auditable reason.
 */
export const COMMON_DEFAULTS: GmRulesInput = {
  v: 1,
  evidence: {
    note: {
      requiredIfAnswer: ['NEJ'],
      minLength: 12,
      bannedPatterns: [
        'hinner\\s*inte',
        'hann\\s*inte',
        'ingen\\s*tid',
        '\\btidsbrist\\b',
        '^nej$',
        '^-+$',
      ],
      bannedMessageSv: 'Skriv VARFÖR ni inte hann – inte «hinner inte».',
      placeholderSv: 'Beskriv orsaken…',
    },
  },
  reminders: [
    { offsetMinutes: -30, severity: 'info' },
    { offsetMinutes: -5, severity: 'warn' },
    { offsetMinutes: 0, severity: 'alarm', fullScreen: true },
    { offsetMinutes: 10, severity: 'alarm', fullScreen: true, repeatEveryMinutes: 10, maxRepeats: 3 },
  ],
};

/** The standard footer, reproduced from the forms. */
export const FOOTER_SV =
  'OBS! Om nej, Skriv ej! "hinner inte", skriv bara varför ni hann inte. ' +
  '*Använd back sida om ni vill förklara mer.';

/** "OBS! Alltid Skicka bild." */
export const PHOTO_ALWAYS: GmRulesInput['evidence'] = {
  photo: { required: 'always', minCount: 1, hintSv: 'OBS! Alltid skicka bild.' },
};
