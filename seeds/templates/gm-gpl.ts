import type { GmRulesInput } from '@/lib/rules/schema';
import type { TemplateSeed } from '../types';
import { COMMON_DEFAULTS, FOOTER_SV } from './common';

/**
 * Checklista GPL GM — the group leader's own list.
 *
 * Source: docs/source-checklists/Checklista_GPL_GM.xls
 * 23 points across three time blocks. Unlike the other three lists this form
 * has only JA and NEJ columns: there is no "Inget behov" escape here, which is
 * encoded in the defaults below rather than repeated on every point.
 */
const GPL_DEFAULTS: GmRulesInput = {
  ...COMMON_DEFAULTS,
  answer: { mode: 'JA_NEJ', allowIngetBehov: false },
};

export const GM_GPL: TemplateSeed = {
  code: 'GM_GPL',
  version: 1,
  nameSv: 'Checklista GPL GM',
  nameEn: 'GM group leader checklist',
  roleHintSv: 'Gruppledare (GPL)',
  shift: 'FULL_DAY',
  shiftStart: '08:00',
  shiftEnd: '17:00',
  footerNotesSv: FOOTER_SV,
  defaults: GPL_DEFAULTS,
  sourceFile: 'Checklista_GPL_GM.xls',

  controlGroups: [
    { key: 'KF1', labelSv: 'Kontrollfält I' },
    { key: 'KF2', labelSv: 'Kontrollfält II' },
    { key: 'KF3', labelSv: 'Kontrollfält III' },
  ],

  sections: [
    {
      key: 'MOR',
      titleSv: 'Morgon 08:00–12:00',
      titleEn: 'Morning 08:00-12:00',
      windowStart: '08:00',
      windowEnd: '12:00',
      items: [
        {
          ordinal: '1',
          textSv:
            'Är personalstyrkan OK för dagen? Se över om arbetsuppgifterna behöver prioriteras om.',
          textEn: 'Is staffing OK for today? Review whether tasks need re-prioritising.',
        },
        {
          ordinal: '2',
          textSv:
            'Är det ZUP på ingång? Är ZUP-raderna fria och klara för påfyllning? Behöver pallar som står i vägen flyttas? Är ytan för ZUP SB-varor fri?',
          textEn:
            'Is ZUP incoming? Are the ZUP rows free and ready? Do blocking pallets need moving? Is the ZUP SB goods area clear?',
        },
        {
          ordinal: '3',
          textSv:
            'Är linefeed-tavlan uppdaterad? Se efter från gårdagen. Om inte — vad behöver åtgärdas?',
          textEn: 'Is the linefeed board updated? Check from yesterday. If not, what needs fixing?',
        },
        {
          ordinal: '4',
          textSv:
            'Se över FIFO:n! Finns det kvar från gårdagen? Behöver det justeras? (Se till att det inte blir en vana att lämna kvar till nästa dag.)',
          textEn:
            'Review the FIFO. Is anything left from yesterday? Does it need adjusting? Leaving work for the next day must not become a habit.',
          controlGroup: 'KF1',
        },
        {
          ordinal: '5',
          textSv:
            'Uppfyller GM 5S från gårdagen på alla stationer? Om inte, se över gårdagens checklista och uppmana till att 5S följs i kvällsrutinen.',
          textEn:
            'Does GM meet 5S from yesterday at every station? If not, review yesterday’s checklist and reinforce 5S in the evening routine.',
          controlGroup: 'KF1',
        },
        {
          ordinal: '6',
          textSv:
            'Se över uppgifter som extra personal kan ta direkt när de kommer. (ZUP är prio 1; finns inte det, se över andra uppgifter.)',
          textEn:
            'Line up tasks extra staff can start on arrival. ZUP is priority 1; if there is none, find other work.',
        },
        {
          ordinal: '7',
          textSv: 'Se över checklistan på truckarna och säkerställ att dessa är testade.',
          textEn: 'Review the forklift checklist and confirm they have been tested.',
          rules: { timing: { dueTime: '09:00' } },
        },
        {
          ordinal: '8',
          textSv: 'Se över mailen! Ta det väsentliga nu — det som är mest akut att svara på.',
          textEn: 'Go through the email. Deal with what is genuinely urgent now.',
        },
      ],
    },

    {
      key: 'MID',
      titleSv: 'Mellanpass 13:00–16:00',
      titleEn: 'Midday 13:00-16:00',
      windowStart: '13:00',
      windowEnd: '16:00',
      items: [
        {
          ordinal: '1',
          textSv:
            'Se över pakettjänsten — är webbreturer och returer bokade? Finns det kvar som inte skickats?',
          textEn:
            'Check the parcel service — are web returns and returns booked? Is anything still unsent?',
        },
        {
          ordinal: '2',
          textSv: 'Är utlagringen gjord för dagen?',
          textEn: 'Has the destocking been done for the day?',
        },
        {
          ordinal: '3',
          textSv:
            'Checka av räkningen och linefeed-ytan med vagnar — behöver det omprioriteras i FIFO:n?',
          textEn:
            'Check the counting and linefeed area with trolleys — does the FIFO need re-prioritising?',
          controlGroup: 'KF2',
        },
        {
          ordinal: '4',
          textSv: 'Är linefeed-tavlan uppdaterad?',
          textEn: 'Is the linefeed board updated?',
          controlGroup: 'KF2',
        },
        {
          ordinal: '5',
          textSv: 'Är SB-varor nerkörda och inlagrade? Se över ej inlagrade ordrar.',
          textEn: 'Have SB goods been driven down and stored? Review any unstored orders.',
        },
        {
          ordinal: '6',
          textSv: 'Är allt klart på GM drive? Är det avslutat? Hur ser ytan ut?',
          textEn: 'Is GM drive finished and closed? What state is the area in?',
        },
      ],
    },

    {
      key: 'EFT',
      titleSv: 'Eftermiddag 16:00–17:00',
      titleEn: 'Afternoon 16:00-17:00',
      windowStart: '16:00',
      windowEnd: '17:00',
      items: [
        {
          ordinal: '1',
          textSv: 'Är reklamationerna inhämtade? Om inte, se över dessa.',
          textEn: 'Have the complaints been collected? If not, review them.',
        },
        {
          ordinal: '2',
          textSv: 'Är SB-varor nerkörda och inlagrade? Se över ej inlagrade ordrar.',
          textEn: 'Have SB goods been driven down and stored? Review any unstored orders.',
        },
        {
          ordinal: '3',
          textSv:
            'Checka av räkningen och linefeed-ytan med vagnar — behöver det omprioriteras i FIFO:n?',
          textEn:
            'Check the counting and linefeed area with trolleys — does the FIFO need re-prioritising?',
        },
        {
          ordinal: '4',
          textSv: 'Är personalstyrkan inför morgondagen OK? Behöver något omprioriteras?',
          textEn: 'Is staffing for tomorrow OK? Does anything need re-prioritising?',
          controlGroup: 'KF3',
        },
        {
          ordinal: '5',
          textSv:
            'Se över översikterna i SAP — är någon order inte avslutad? Stora ordrar kvar? Omprioritering i FIFO:n?',
          textEn:
            'Review the SAP overviews — any unclosed orders? Large orders left? FIFO re-prioritisation?',
          controlGroup: 'KF3',
        },
        {
          ordinal: '6',
          textSv:
            'Se över ZUP för nästkommande dag. Stor? Liten? Fler bilar? Behöver raderna bli fria inför det? Behöver linefeed prioritera detta nu — annars lägg till på kvällens checklista.',
          textEn:
            'Review ZUP for the next day. Large? Small? More lorries? Do rows need clearing? Should linefeed prioritise it now, or should it go on the evening checklist?',
          controlGroup: 'KF3',
        },
        {
          ordinal: '7',
          textSv:
            'Är Zebra-scannrarna på plats? Saknas någon? Om ja — vilken, och var finns den?',
          textEn: 'Are the Zebra scanners all present? If any is missing, which one and where is it?',
          controlGroup: 'KF3',
          rules: {
            fields: [
              {
                key: 'saknad_scanner',
                type: 'TEXT',
                labelSv: 'Vilken scanner saknas, och var?',
                labelEn: 'Which scanner is missing, and where?',
                requiredIfAnswer: ['NEJ'],
                maxLength: 200,
              },
            ],
          },
        },
        {
          ordinal: '8',
          textSv:
            'Uppfyller GM 5S? Om inte, se över detta och lägg till i checklistan för kvällspersonalen.',
          textEn:
            'Does GM meet 5S? If not, address it and add it to the evening staff’s checklist.',
          controlGroup: 'KF3',
        },
        {
          ordinal: '9',
          textSv:
            'Checklistan inför kvällspersonalen läggs fram, med tillägg för det som behöver prioriteras inför kvällen och morgondagen.',
          textEn:
            'The evening staff’s checklist is prepared, with additions for what must be prioritised tonight and tomorrow.',
          controlGroup: 'KF3',
          rules: {
            timing: { dueTime: '17:00' },
            // This is the shift handover the paper form already performs.
            handover: { toShift: 'EVENING', createsHandoverRecord: true },
            escalation: {
              on: ['OVERDUE'],
              delayMinutes: 15,
              targets: [{ type: 'ROLE', value: 'ADMIN' }],
              messageSv: 'Kvällschecklistan är inte förberedd — kvällspasset startar utan den.',
            },
          },
        },
      ],
    },
  ],
};
