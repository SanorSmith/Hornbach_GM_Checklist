import type { TemplateSeed } from '../types';
import { COMMON_DEFAULTS, FOOTER_SV, PHOTO_ALWAYS } from './common';

/**
 * Checklista GM Linefeeder KVÄLL.
 *
 * Source: docs/source-checklists/Checklista_GM_Linefeeder_KVALL.xls
 * 20 points: 4 + 11 for the primary linefeeder, and 5 more on the form's
 * separate "Checklista Person 2" with its own "Genomförs av" signature line.
 */
export const GM_LF_KVALL: TemplateSeed = {
  code: 'GM_LF_KVALL',
  version: 1,
  nameSv: 'Checklista GM Linefeeder KVÄLL',
  nameEn: 'GM Linefeeder checklist — evening',
  roleHintSv: 'Linefeeder, kvällspass',
  shift: 'EVENING',
  shiftStart: '13:00',
  shiftEnd: '20:00',
  footerNotesSv: FOOTER_SV,
  defaults: COMMON_DEFAULTS,
  sourceFile: 'Checklista_GM_Linefeeder_KVALL.xls',

  controlGroups: [
    { key: 'KF1', labelSv: 'Kontrollfält I' },
    { key: 'KF2', labelSv: 'Kontrollfält II' },
  ],

  sections: [
    {
      key: 'REK',
      titleSv: 'Returer / Reklamationer',
      titleEn: 'Returns / Complaints',
      items: [
        {
          ordinal: '1',
          textSv: 'Är dagens returer och reklamationer inlagrade senast kl. 18:00?',
          textEn: 'Have today’s returns and complaints been stored by 18:00?',
          controlGroup: 'KF1',
          rules: { timing: { dueTime: '18:00' } },
        },
        {
          ordinal: '2',
          textSv: 'Är alla kontrollrundor fram till kl. 19:45 genomförda och tavlan uppdaterad?',
          textEn: 'Are all control rounds up to 19:45 done and the board updated?',
          controlGroup: 'KF1',
          rules: { timing: { dueTime: '19:45' } },
        },
        {
          ordinal: '3',
          textSv:
            'Är gruppledaren / morgonpersonalen meddelad om eventuella "ej upphittade reklamationer"?',
          textEn:
            'Have the group leader / morning staff been told about any complaints that could not be found?',
          rules: {
            // The paper already works this way: a "no" here has to reach the
            // next shift, or the morning starts blind.
            escalation: {
              on: ['ANSWER_NEJ'],
              delayMinutes: 0,
              targets: [{ type: 'ROLE', value: 'GROUP_LEADER' }, { type: 'NEXT_SHIFT_PRIMARY' }],
              messageSv:
                'Ej upphittade reklamationer — gruppledare och morgonpersonal måste informeras.',
              autoExpireMinutes: 720,
            },
            handover: { toShift: 'MORNING', createsHandoverRecord: true },
          },
        },
        {
          ordinal: '4',
          textSv: 'Är reklamationsutlagringen gjord för dagen?',
          textEn: 'Has the complaint destocking been done for the day?',
        },
      ],
    },

    {
      key: 'GARD',
      titleSv: 'GM Gård / Städning',
      titleEn: 'GM Yard / Cleaning',
      items: [
        {
          ordinal: '1',
          textSv: 'Är pallarna på GM-gården sorterade och staplade senast klockan 18:00?',
          textEn: 'Are the pallets in the GM yard sorted and stacked by 18:00?',
          rules: { timing: { dueTime: '18:00' } },
        },
        {
          ordinal: '2',
          textSv:
            'Är GM-gårdens golvyta skräpfri? Är allt skräp sorterat och kastat senast kl. 19:30?',
          textEn: 'Is the GM yard floor litter-free, with all waste sorted and disposed of by 19:30?',
          rules: { timing: { dueTime: '19:30' } },
        },
        {
          ordinal: '3',
          textSv:
            'Är golvet sopat? Runt wellpapp- och plastpressarna, räknestationen och GM-golvet.',
          textEn:
            'Has the floor been swept — around the cardboard and plastic presses, the counting station and the GM floor?',
        },
        {
          ordinal: '4',
          textSv: 'Är sopkärlen tömda vid pressarna (brännbart, band, frigolit)?',
          textEn: 'Have the bins at the presses been emptied (burnable, strapping, polystyrene)?',
          helpSv: 'OBS! Alltid skicka bild. Om nej, skriv varför.',
          rules: { evidence: PHOTO_ALWAYS },
        },
        {
          ordinal: '5',
          textSv: 'Är sopkärlen tömda vid räkningsbordet?',
          textEn: 'Have the bins at the counting table been emptied?',
        },
        {
          ordinal: '6',
          textSv: 'Är alla GM-telefoner och scanners på laddning? Stäng av telefonerna!',
          textEn: 'Are all GM phones and scanners on charge? Switch the phones off!',
          controlGroup: 'KF2',
        },
        {
          ordinal: '7',
          textSv: 'Är trädgårdssoporna tömda för kvällen, fram till kl. 17:00?',
          textEn: 'Has the garden waste been emptied for the evening, by 17:00?',
          helpSv: 'OBS! Alltid skicka bild. Om nej, skriv varför.',
          controlGroup: 'KF2',
          rules: { timing: { dueTime: '17:00' }, evidence: PHOTO_ALWAYS },
        },
        {
          ordinal: '8',
          textSv: 'Är ytterporten till GM-gården nerdragen? Om inte — det är ett måste!',
          textEn: 'Is the outer gate to the GM yard pulled down? If not — it is mandatory!',
        },
        {
          ordinal: '9',
          textSv:
            'Är alla registrerade följesedlar hängda på räkningsbordet, varje följesedel klämd på en träclipboard, fram till kl. 19:00 — eller 17:00 på helgerna?',
          textEn:
            'Are all registered delivery notes hung at the counting table, each clipped to a wooden clipboard, by 19:00 — or 17:00 at weekends?',
          rules: {
            timing: {
              dueTime: '19:00',
              variants: [
                {
                  when: { weekdayIn: ['SAT', 'SUN'] },
                  dueTime: '17:00',
                  reasonSv: 'Helg — tidigare deadline',
                },
              ],
            },
          },
        },
        {
          ordinal: '10',
          textSv:
            'Se över GM-truckarnas laddningspinnar — behöver dessa laddas? Gäller motviktaren samt våra ledstaplare.',
          textEn:
            'Check the charging pins on the GM forklifts — do they need charging? Counterbalance and pallet stackers.',
        },
        {
          ordinal: '11',
          textSv:
            'Skicka 2 bilder på GM:s golvyta och 2 bilder på GM-gården till GM-mejlet. Minst 15 min innan hemgång.',
          textEn:
            'Send 2 photos of the GM floor and 2 of the GM yard to the GM mailbox, at least 15 minutes before leaving.',
          helpSv: 'OBS! Alltid skicka bild.',
          rules: {
            // "minst 15 min innan hemgång" is relative to the shift, not a clock time.
            timing: { relativeDue: { anchor: 'shift_end', offsetMinutes: -15 } },
            evidence: {
              photo: {
                required: 'always',
                minCount: 4,
                hintSv: '2 bilder GM-golv + 2 bilder GM-gård.',
                groups: [
                  { key: 'golv', labelSv: 'GM-golv', labelEn: 'GM floor', minCount: 2 },
                  { key: 'gard', labelSv: 'GM-gård', labelEn: 'GM yard', minCount: 2 },
                ],
              },
            },
          },
        },
      ],
    },

    {
      key: 'P2',
      titleSv: 'Checklista Person 2',
      titleEn: 'Checklist — Person 2',
      // The form has a second "Genomförs av" line: this half is performed and
      // signed by a different person.
      assigneeSlot: 2,
      slotLabelSv: 'Genomförs av (Person 2)',
      items: [
        {
          ordinal: '1',
          textSv:
            'Har alla leveranser som ska räknas blivit registrerade fram till kl. 19:30? (Inga avslutade leveranser återstår i räkningsraden.)',
          textEn:
            'Have all deliveries to be counted been registered by 19:30? (No closed deliveries left in the counting row.)',
          rules: { timing: { dueTime: '19:30' } },
        },
        {
          ordinal: '2',
          textSv: 'Se över översikterna i SAP — är någon order inte avslutad?',
          textEn: 'Check the overviews in SAP — is any order still open?',
        },
        {
          ordinal: '3',
          textSv:
            'Är godset från dagen flyttat från hörnan vid handfatet och laddningsstationen? Är ytan fri från utspridda varor? In med dessa i rätt rad i linjerna!',
          textEn:
            'Have the day’s goods been moved from the corner by the sink and charging station? Is the area clear of scattered goods?',
        },
        {
          ordinal: '4',
          textSv:
            'Är båda lastkajerna tömda på varor? Minst den vänstra kajen måste vara helt fri från gods.',
          textEn:
            'Have both loading docks been cleared? At least the left dock must be completely free of goods.',
        },
        {
          ordinal: '5',
          textSv:
            'Rullporten (den röda porten) måste vara neddragen till hälften, till de markerade pilarna.',
          textEn:
            'The roller door (the red one) must be pulled halfway down, to the marked arrows.',
        },
      ],
    },
  ],
};
