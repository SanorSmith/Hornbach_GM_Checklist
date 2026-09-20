import { findChecklist, getSeed, getTemplate } from '@/lib/checklists';
import { repository } from '@/lib/repo';
import type { AttachmentMeta, ControlStatus, RunDetail } from '@/lib/repo/types';
import { mergeRules } from '@/lib/rules/merge';

/**
 * One finished checklist, assembled as the filed paper copy of it.
 *
 * This is deliberately the whole form, not a summary: every point in the
 * template appears, answered or not, in the order it is printed on the paper.
 * An unanswered point is information — it is the blank line on the sheet — so
 * leaving it out would make the record say something the run does not.
 *
 * Nothing here is recomputed. No deadline is re-evaluated, no rule is re-run:
 * a record of what was done must not change its mind months later because a
 * template was edited. The one thing that can drift is the form itself, which
 * is why `templateVersionMatches` is reported rather than hidden.
 */

/**
 * A photo with a name to print.
 *
 * Nothing stores an original filename — the photos come straight off the
 * camera and are recompressed on the device before upload, so whatever the
 * camera called the file is neither kept nor meaningful. The name is built
 * from what the record already knows: which point it belongs to, which photo
 * of that point it is, and a short slice of the id, which is what a leader
 * would use to find this exact picture in the system later.
 */
export interface RecordPhoto extends AttachmentMeta {
  /** e.g. `CONT.02-1.jpg` */
  name: string;
  /** First 8 characters of the id, enough to find the row by hand. */
  shortId: string;
}

export interface RecordField {
  key: string;
  labelSv: string;
  value: string | number | null;
}

export interface RecordItem {
  code: string;
  ordinal: string;
  textSv: string;
  helpSv: string | null;
  controlGroupSv: string | null;
  answer: 'JA' | 'NEJ' | 'INGET_BEHOV' | null;
  /** The answer as it reads on paper: 'Ja', 'Nej', 'Inget behov', or a code. */
  answerSv: string | null;
  note: string | null;
  fields: RecordField[];
  photos: RecordPhoto[];
  answeredAt: string | null;
}

export interface RecordSection {
  id: string;
  titleSv: string;
  noteSv: string | null;
  /** 'Morgon 08:00–12:00' blocks on the GPL list. */
  windowSv: string | null;
  assigneeSlot: number;
  slotLabelSv: string | null;
  items: RecordItem[];
}

export interface RecordSignature {
  slot: number;
  displayName: string;
  username: string;
  signedAt: string;
  /** 'Genomförs av (Person 2)' where the form names the slot. */
  slotLabelSv: string | null;
  /** Base64 PNG of the name written with a finger, when there is one. */
  drawnSignature: string | null;
}

export interface RunRecord {
  runId: string;
  code: string;
  nameSv: string;
  roleSv: string;
  businessDate: string;
  status: 'OPEN' | 'SUBMITTED';
  /** The version the run was performed on, which is the one that governs it. */
  runTemplateVersion: number;
  currentTemplateVersion: number;
  /**
   * False when the form has been edited since. The record still renders, but
   * it says so: a filed document that quietly shows today's wording against
   * last year's answers is worse than one that admits the difference.
   */
  templateVersionMatches: boolean;
  sections: RecordSection[];
  signatures: RecordSignature[];
  control: {
    status: ControlStatus;
    by: string | null;
    at: string | null;
    note: string | null;
  };
  footerNotesSv: string | null;
  answered: number;
  total: number;
}

const EXTENSION: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
};

/** `GM_LF_MORGON.CONT.02` + the second photo of it -> `CONT.02-2.jpg`. */
export function photoNameFor(
  itemCode: string,
  contentType: string,
  index: number,
): string {
  // Drop the template prefix: the record's own header already says which
  // checklist and which day this is, so repeating it on every line is noise.
  const point = itemCode.split('.').slice(1).join('.') || itemCode;
  const extension = EXTENSION[contentType.toLowerCase()] ?? 'bild';
  return `${point}-${index + 1}.${extension}`;
}

const ANSWER_SV: Record<'JA' | 'NEJ' | 'INGET_BEHOV', string> = {
  JA: 'Ja',
  NEJ: 'Nej',
  INGET_BEHOV: 'Inget behov',
};

/** Builds the filed copy of one run, or null if there is no such run. */
export async function buildRunRecord(runId: string): Promise<RunRecord | null> {
  const repo = repository();
  const run = await repo.getRun(runId);
  if (!run) return null;

  const template = getTemplate(run.templateCode);
  const seed = getSeed(run.templateCode);
  const summary = findChecklist(run.templateCode);
  if (!template || !seed) return null;

  const attachments = await repo.listAttachments(run.id);
  return assembleRecord({ run, template, seed, summary, attachments });
}

type Assembled = {
  run: RunDetail;
  template: NonNullable<ReturnType<typeof getTemplate>>;
  seed: NonNullable<ReturnType<typeof getSeed>>;
  summary: ReturnType<typeof findChecklist>;
  attachments: AttachmentMeta[];
};

function assembleRecord({ run, template, seed, summary, attachments }: Assembled): RunRecord {
  const stateByCode = new Map(run.items.map((i) => [i.itemCode, i]));
  const photosByCode = new Map<string, AttachmentMeta[]>();
  for (const photo of attachments) {
    photosByCode.set(photo.itemCode, [...(photosByCode.get(photo.itemCode) ?? []), photo]);
  }

  const controlGroupLabel = new Map(
    (seed.controlGroups ?? []).map((g) => [`${seed.code}.${g.key}`, g.labelSv]),
  );

  let answered = 0;
  let total = 0;

  const sections: RecordSection[] = template.sections
    .slice()
    .sort((a, b) => a.sortIndex - b.sortIndex)
    .map((section) => {
      const items = template.items
        .filter((i) => i.sectionId === section.id)
        .sort((a, b) => a.sortIndex - b.sortIndex)
        .map((item): RecordItem => {
          const state = stateByCode.get(item.code);
          const rules = mergeRules(template.defaults, section.rules, item.rules);

          // Every field the form defines, in the form's order, so an empty one
          // reads as a blank on the sheet rather than silently disappearing.
          const fields: RecordField[] = (rules.fields ?? []).map((field) => ({
            key: field.key,
            labelSv: field.labelSv,
            value: state?.fields?.[field.key] ?? null,
          }));

          const answer = state?.answer ?? null;
          const coded = rules.answer?.codes?.find((c) => c.value === state?.answerCode);

          total += 1;
          if (answer !== null || state?.answerCode) answered += 1;

          return {
            code: item.code,
            ordinal: item.ordinal,
            textSv: item.textSv,
            helpSv: item.helpSv ?? null,
            controlGroupSv: item.controlGroupId
              ? (controlGroupLabel.get(item.controlGroupId) ?? null)
              : null,
            answer,
            answerSv: coded
              ? `${coded.value} — ${coded.labelSv}`
              : answer
                ? ANSWER_SV[answer]
                : (state?.answerCode ?? null),
            note: state?.note ?? null,
            fields,
            photos: (photosByCode.get(item.code) ?? []).map((photo, index) => ({
              ...photo,
              name: photoNameFor(item.code, photo.contentType, index),
              shortId: photo.id.slice(0, 8),
            })),
            answeredAt: state?.answeredAt ?? null,
          };
        });

      return {
        id: section.id,
        titleSv: section.titleSv,
        noteSv: section.noteSv ?? null,
        windowSv:
          section.windowStart && section.windowEnd
            ? `${section.windowStart}–${section.windowEnd}`
            : (section.windowStart ?? section.windowEnd ?? null),
        assigneeSlot: section.assigneeSlot,
        slotLabelSv: section.slotLabelSv ?? null,
        items,
      };
    });

  // The slot label belongs to the section the slot performs, which is where
  // the paper form prints "Genomförs av (Person 2)".
  const slotLabel = new Map<number, string>();
  for (const section of sections) {
    if (section.slotLabelSv && !slotLabel.has(section.assigneeSlot)) {
      slotLabel.set(section.assigneeSlot, section.slotLabelSv);
    }
  }

  const signatures: RecordSignature[] = run.signatures
    .filter((s) => s.purpose === 'WORKER_SUBMIT')
    .sort((a, b) => a.slot - b.slot)
    .map((s) => ({
      slot: s.slot,
      displayName: s.displayName,
      username: s.username,
      signedAt: s.signedAt,
      slotLabelSv: slotLabel.get(s.slot) ?? null,
      drawnSignature: s.drawnSignature,
    }));

  return {
    runId: run.id,
    code: run.templateCode,
    nameSv: template.nameSv,
    roleSv: summary?.roleSv ?? seed.roleHintSv,
    businessDate: run.businessDate,
    status: run.status,
    runTemplateVersion: run.templateVersion,
    currentTemplateVersion: template.version,
    templateVersionMatches: run.templateVersion === template.version,
    sections,
    signatures,
    control: run.control,
    footerNotesSv: template.footerNotesSv ?? null,
    answered,
    total,
  };
}
