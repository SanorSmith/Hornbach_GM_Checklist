import type { TemplateSeed } from '../types';
import { COMMON_DEFAULTS, FOOTER_SV } from './common';

/**
 * Checklista för GM-personal vid dörren.
 *
 * Source: docs/source-checklists/Checklista_GM-personal_vid_dorren.xls
 * 14 points. No clock deadlines on the form — these are gating checks done as
 * the lorries arrive — but several carry counts that the group leader reads.
 */
export const GM_DORR: TemplateSeed = {
  code: 'GM_DORR',
  version: 1,
  nameSv: 'Checklista för GM-personal vid dörren',
  nameEn: 'Checklist for GM staff at the door',
  roleHintSv: 'GM-personal vid dörren',
  shift: 'FULL_DAY',
  shiftStart: '06:00',
  shiftEnd: '18:00',
  footerNotesSv: FOOTER_SV,
  defaults: COMMON_DEFAULTS,
  sourceFile: 'Checklista_GM-personal_vid_dorren.xls',

  controlGroups: [{ key: 'KF1', labelSv: 'Kontrollfält I' }],

  sections: [
    {
      key: 'DORR',
      titleSv: 'Beläggningstavlan / Reklamationer',
      titleEn: 'Occupancy board / Complaints',
      items: [
        {
          ordinal: '1',
          textSv: 'Är båda lastkajerna rensade och tomma för att kunna ta emot lastbilarna?',
          textEn: 'Are both loading docks cleared and empty, ready to receive the lorries?',
        },
        {
          ordinal: '2',
          textSv: 'Är alla GM-rader sorterade och klara innan vi börjar ta emot bilar?',
          textEn: 'Are all GM rows sorted and ready before we start receiving lorries?',
        },
        {
          ordinal: '3',
          textSv:
            'Har alla färdigbokade returer som skulle lämnas till speditörerna redan lämnats?',
          textEn: 'Have all booked returns due to the forwarders already been handed over?',
          controlGroup: 'KF1',
          rules: {
            fields: [
              {
                key: 'antal_ska_skickas',
                type: 'INTEGER',
                labelSv: 'Antal ska skickas',
                labelEn: 'Number to send',
                requiredIfAnswer: ['JA', 'NEJ'],
                min: 0,
                max: 999,
              },
              {
                key: 'antal_kvar',
                type: 'INTEGER',
                labelSv: 'Antal kvar',
                labelEn: 'Number remaining',
                requiredIfAnswer: ['JA', 'NEJ'],
                min: 0,
                max: 999,
              },
            ],
          },
        },
        {
          ordinal: '4',
          textSv:
            'Är alla reklamationer som är äldre än 13 dagar utlagrade? Har leverantörerna mejlats där det behövs?',
          textEn:
            'Have all complaints older than 13 days been destocked? Have suppliers been emailed where needed?',
          helpSv: 'OBS! Dagens utlagringslista ska lämnas till GL!',
          controlGroup: 'KF1',
        },
        {
          ordinal: '5',
          textSv: 'Har reklamationerna kasserats enligt rutin?',
          textEn: 'Have the complaints been scrapped according to procedure?',
          controlGroup: 'KF1',
        },
        {
          ordinal: '6',
          textSv: 'Har ni kontrollerat stora kommande leveranser på Cargoclix?',
          textEn: 'Have you checked large incoming deliveries on Cargoclix?',
          controlGroup: 'KF1',
          rules: {
            fields: [
              {
                key: 'antal_bilar',
                type: 'INTEGER',
                labelSv: 'Antal bilar',
                labelEn: 'Number of lorries',
                requiredIfAnswer: ['JA'],
                min: 0,
                max: 99,
              },
              {
                key: 'gods_typ',
                type: 'TEXT',
                labelSv: 'Godstyp',
                labelEn: 'Goods type',
                requiredIfAnswer: ['JA'],
                maxLength: 120,
              },
            ],
          },
        },
        {
          ordinal: '7',
          textSv: 'Är A/B/Norrlandspallar bokade enligt linefeederns efterfrågan i checklistan?',
          textEn: 'Have A/B/Norrland pallets been booked per the linefeeder’s request?',
          controlGroup: 'KF1',
        },
        {
          ordinal: '8',
          textSv:
            'Har underlaget för webbköpsreturer mejlats till Onlineköp för att boka frakten?',
          textEn: 'Has the web-purchase return basis been emailed to Online Purchasing to book freight?',
        },
        {
          ordinal: '9',
          textSv: 'Är ZUP-leveranserna avslutade?',
          textEn: 'Have the ZUP deliveries been closed?',
        },
        {
          ordinal: '10',
          textSv:
            'Är alla kundorder från ZUP mottagna och överlämnade till linefeedern för utkörning?',
          textEn: 'Have all ZUP customer orders been received and handed to the linefeeder?',
          rules: { sequence: { requiresItems: ['GM_DORR.DORR.09'] } },
        },
        {
          ordinal: '11',
          textSv:
            'Har onlineordrar och webbreturer plockats ut från de inkommande leveranserna på räkningsraderna och lämnats ut enligt gällande rutiner?',
          textEn:
            'Have online orders and web returns been picked from the incoming deliveries on the counting rows and handed out per procedure?',
        },
        {
          ordinal: '12',
          textSv:
            'Arbetssäkerhetschecklistan ska lämnas över till den kollega som är registrerad på veckans säkerhetsschema.',
          textEn:
            'The work-safety checklist must be handed to the colleague on this week’s safety schedule.',
          rules: {
            fields: [
              {
                key: 'lamnades_till',
                type: 'PERSON_REF',
                labelSv: 'Lämnades till',
                labelEn: 'Handed to',
                requiredIfAnswer: ['JA'],
              },
            ],
            // A named handover, so the chain of custody is recorded rather than
            // remembered.
            handover: {
              toShift: 'FULL_DAY',
              createsHandoverRecord: true,
              personField: 'lamnades_till',
            },
          },
        },
        {
          ordinal: '13',
          textSv: 'Har alla signerade returfraktsedlar lämnats in i fraktsedelspärmen?',
          textEn: 'Have all signed return waybills been filed in the waybill binder?',
        },
        {
          ordinal: '14',
          textSv:
            'Har CC-vagnarna uppdaterats i Excel-filen med antalet in- och utlämnade CC-vagnar, och har kopior av CMR:erna lämnats in i CC-vagnspärmen?',
          textEn:
            'Have the CC trolleys been updated in the Excel file with in/out counts, and CMR copies filed in the CC trolley binder?',
        },
      ],
    },
  ],
};
