import type { TemplateSeed } from '../types';
import { COMMON_DEFAULTS, FOOTER_SV, PHOTO_ALWAYS } from './common';

/**
 * Checklista GM Linefeeder MORGON.
 *
 * Source: docs/source-checklists/Checklista_GM_Linefeeder_MORGON.xls
 * 18 points across three sections, with deadlines from 07:00 to 15:00.
 */
export const GM_LF_MORGON: TemplateSeed = {
  code: 'GM_LF_MORGON',
  version: 2,
  nameSv: 'Checklista GM Linefeeder MORGON',
  nameEn: 'GM Linefeeder checklist — morning',
  roleHintSv: 'Linefeeder, morgonpass',
  shift: 'MORNING',
  shiftStart: '06:00',
  shiftEnd: '15:00',
  footerNotesSv: FOOTER_SV,
  defaults: COMMON_DEFAULTS,
  sourceFile: 'Checklista_GM_Linefeeder_MORGON.xls',

  controlGroups: [
    { key: 'KF1', labelSv: 'Kontrollfält I' },
    // The label cell for this block is blank on the original form; the merge
    // spanning the Container rows is what identifies it.
    { key: 'KF2', labelSv: 'Kontrollfält II' },
    { key: 'KF3', labelSv: 'Kontrollfält III' },
  ],

  sections: [
    {
      key: 'BEL',
      titleSv: 'Beläggningstavlan / Reklamationer',
      titleEn: 'Occupancy board / Complaints',
      items: [
        {
          ordinal: '1',
          textSv: 'Har alla truckar kontrollerats enligt checklistan senast 07:00?',
          textEn: 'Have all forklifts been checked per their checklist by 07:00?',
          rules: { timing: { dueTime: '07:00' } },
        },
        {
          ordinal: '2',
          textSv:
            'Är alla utkörda pallar på röda punkter markerade med gårdagens datum?',
          textEn: 'Are all pallets delivered to red points marked with yesterday’s date?',
          controlGroup: 'KF1',
        },
        {
          ordinal: '3',
          textSv: 'Har allt skräp hämtats från avdelningarna senast klockan 07:00?',
          textEn: 'Has all waste been collected from the departments by 07:00?',
          controlGroup: 'KF1',
          rules: { timing: { dueTime: '07:00' } },
        },
        {
          ordinal: '4',
          textSv: 'Är kontrollrundan fram till kl. 08:15 genomförd och tavlan uppdaterad?',
          textEn: 'Is the control round up to 08:15 done and the board updated?',
          controlGroup: 'KF1',
          rules: { timing: { dueTime: '08:15' } },
        },
        {
          ordinal: '5',
          textSv:
            'Är alla "inlagrade reklamationer från gårdagen" upphittade, fram till kl. 08:30?',
          textEn: 'Have all complaints stored yesterday been located, by 08:30?',
          controlGroup: 'KF1',
          rules: { timing: { dueTime: '08:30' } },
        },
        {
          ordinal: '6',
          textSv: 'Är kl. 10:00-kontrollrundan klar?',
          textEn: 'Is the 10:00 control round complete?',
          rules: {
            timing: { dueTime: '10:00' },
            // The 08:15 round has to happen before the 10:00 one can mean anything.
            sequence: { requiresItems: ['GM_LF_MORGON.BEL.04'] },
          },
        },
        {
          ordinal: '7',
          textSv: 'Hämta returer kl. 13:00.',
          textEn: 'Collect returns at 13:00.',
          rules: { timing: { dueTime: '13:00', windowStart: '12:30' } },
        },
        {
          ordinal: '8',
          textSv:
            'Fyll på GM:s hyllor för eget bruk, och beställ om det behövs. Skriv F om ni fyllt på, eller B för beställt.',
          textEn:
            'Refill GM’s own-use shelves and order if needed. Write F if refilled, or B if ordered.',
          rules: {
            answer: {
              mode: 'CODED',
              codes: [
                { value: 'F', labelSv: 'Fylld på', labelEn: 'Refilled' },
                { value: 'B', labelSv: 'Beställd', labelEn: 'Ordered' },
              ],
            },
          },
        },
      ],
    },

    {
      key: 'CONT',
      titleSv: 'Container',
      titleEn: 'Containers',
      noteSv: 'OBS! Skicka en bild till mejlet om inget behov.',
      // Applies to every point in this section: "inget behov" still needs proof.
      rules: { answer: { onIngetBehov: { requiresPhoto: true, minPhotos: 1 } } },
      items: [
        {
          ordinal: '1',
          textSv: 'Kontrollera träcontainern — behöver den tömmas? Fram till kl. 11:30.',
          textEn: 'Check the wood container — does it need emptying? By 11:30.',
          controlGroup: 'KF2',
          rules: { timing: { dueTime: '11:30' } },
        },
        {
          ordinal: '2',
          textSv: 'Kontrollera kakelcontainern — behöver den tömmas? Fram till kl. 11:30.',
          textEn: 'Check the tile container — does it need emptying? By 11:30.',
          helpSv: 'OBS! Alltid skicka bild.',
          controlGroup: 'KF2',
          rules: { timing: { dueTime: '11:30' }, evidence: PHOTO_ALWAYS },
        },
        {
          ordinal: '3',
          textSv: 'Töm tunnorna (trä, metall, el, deponi) senast fram till kl. 11:30.',
          textEn: 'Empty the bins (wood, metal, electrical, landfill) by 11:30.',
          helpSv: 'OBS! Alltid skicka bild. Om nej, skriv varför.',
          controlGroup: 'KF2',
          rules: { timing: { dueTime: '11:30' }, evidence: PHOTO_ALWAYS },
        },
        {
          ordinal: '4',
          textSv: 'Är trädgårdens gröna container tom?',
          textEn: 'Is the garden green container empty?',
          helpSv: 'OBS! Alltid skicka bild.',
          controlGroup: 'KF2',
          rules: { evidence: PHOTO_ALWAYS },
        },
        {
          ordinal: '5',
          textSv: 'Trädgårdens säsongspunkt (TS) — har allt skräp hämtats?',
          textEn: 'Garden seasonal point (TS) — has all waste been collected?',
          helpSv: 'OBS! Alltid skicka bild.',
          controlGroup: 'KF2',
          rules: { evidence: PHOTO_ALWAYS },
        },
        {
          ordinal: '6',
          textSv:
            'Har alla tomma jordpallar hämtats? OBS! Minst 17 pallar per stuva. Senast kl. 12:00.',
          textEn: 'Have all empty soil pallets been collected? At least 17 per stack. By 12:00.',
          controlGroup: 'KF2',
          rules: {
            timing: { dueTime: '12:00' },
            fields: [
              {
                key: 'pallar_per_stuva',
                type: 'INTEGER',
                labelSv: 'Pallar per stuva',
                labelEn: 'Pallets per stack',
                requiredIfAnswer: ['JA'],
                min: 17,
                max: 60,
                violationMessageSv: 'Minst 17 pallar per stuva.',
              },
            ],
          },
        },
      ],
    },

    {
      key: 'PALL',
      titleSv: 'Pallar / GM Gård',
      titleEn: 'Pallets / GM Yard',
      items: [
        {
          ordinal: '1',
          textSv:
            'Är pallarna på gården sorterade och staplade? Är gården städad och skräpet slängt senast kl. 15:00?',
          textEn:
            'Are the yard pallets sorted and stacked? Is the yard cleaned and waste disposed of by 15:00?',
          helpSv: 'OBS! Alltid skicka bild. Om nej, skriv varför.',
          controlGroup: 'KF3',
          rules: { timing: { dueTime: '15:00' }, evidence: PHOTO_ALWAYS },
        },
        {
          ordinal: '2',
          textSv: 'Är bokning av THM-pallhämtning genomförd?',
          textEn: 'Has the THM pallet collection been booked?',
          controlGroup: 'KF3',
          rules: {
            fields: [
              {
                key: 'antal_stuva',
                type: 'INTEGER',
                labelSv: 'Antal stuva',
                labelEn: 'Number of stacks',
                requiredIfAnswer: ['JA', 'NEJ'],
                min: 0,
                max: 99,
              },
            ],
          },
        },
        {
          ordinal: '3',
          textSv: 'Är bokning av jordpall genomförd? OBS! ENDAST OM 6–7 STUVA FINNS!',
          textEn: 'Has the soil pallet booking been made? ONLY IF THERE ARE 6-7 STACKS!',
          rules: {
            // Reads the count entered on the point above, so the question only
            // appears when the paper form says it applies.
            //
            // "ENDAST OM 6-7 Stuv FINNS" is a trigger, not a window: six or
            // seven stacks is when the yard has filled up enough to book, and
            // it still needs booking at eight or twelve. Read literally as
            // 6–7 and nothing else, this refused the booking exactly when the
            // yard was fullest.
            visibility: {
              condition: {
                op: 'gte',
                left: { ref: 'field', item: 'GM_LF_MORGON.PALL.02', key: 'antal_stuva' },
                right: { ref: 'const', value: 6 },
              },
              whenFalse: 'NOT_APPLICABLE',
              explainSv: 'Fyll i «Antal stuva» ovan. Bokas när det finns 6 stuva eller fler.',
            },
            fields: [
              {
                key: 'antal_pallar',
                type: 'INTEGER',
                labelSv: 'Antal pallar',
                labelEn: 'Number of pallets',
                requiredIfAnswer: ['JA'],
                min: 0,
                max: 999,
              },
            ],
          },
        },
        {
          ordinal: '4',
          textSv: 'Kontrollrunda för sophantering genomförd kl. 11:00.',
          textEn: 'Waste-handling control round completed at 11:00.',
          rules: { timing: { dueTime: '11:00' } },
        },
      ],
    },
  ],
};
