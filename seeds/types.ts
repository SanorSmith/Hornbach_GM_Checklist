import type { GmRulesInput } from '@/lib/rules/schema';

/**
 * Checklist templates, authored as TypeScript rather than loose JSON.
 *
 * The plan called for JSON validated by Zod in CI. TypeScript is strictly
 * better here: a mistyped rule key or an impossible enum value is a compile
 * error rather than something a validation step has to catch later, and these
 * files encode the deadlines a warehouse actually runs on. The seeder writes
 * them to the database as JSONB, which is what the template builder will edit.
 *
 * Source of truth for the wording: the .xls files in docs/source-checklists/.
 */

export interface ItemSeed {
  /** The number printed on the paper form. */
  ordinal: string;
  textSv: string;
  textEn?: string;
  /** The "OBS!" notes printed beside a point. */
  helpSv?: string;
  /** Which Kontrollfält block the group leader after-controls this under. */
  controlGroup?: string;
  rules?: GmRulesInput;
}

export interface SectionSeed {
  key: string;
  titleSv: string;
  titleEn?: string;
  noteSv?: string;
  /** The GPL list's time blocks. */
  windowStart?: string;
  windowEnd?: string;
  /** 2 marks the evening list's "Checklista Person 2". */
  assigneeSlot?: number;
  slotLabelSv?: string;
  /** Inherited by every point in the section. */
  rules?: GmRulesInput;
  items: ItemSeed[];
}

export interface TemplateSeed {
  code: string;
  version: number;
  nameSv: string;
  nameEn: string;
  roleHintSv: string;
  shift: 'MORNING' | 'MIDDAY' | 'EVENING' | 'FULL_DAY';
  shiftStart: string;
  shiftEnd: string;
  footerNotesSv?: string;
  /** Inherited by every section and point. */
  defaults?: GmRulesInput;
  controlGroups: { key: string; labelSv: string }[];
  sections: SectionSeed[];
  sourceFile: string;
}

/** `GM_LF_MORGON.CONT.03` — stable across versions, and what reports join on. */
export function itemCode(template: string, section: string, ordinal: string): string {
  const numeric = ordinal.replace(/\D/g, '').padStart(2, '0');
  return `${template}.${section}.${numeric}`;
}

export function countItems(seed: TemplateSeed): number {
  return seed.sections.reduce((total, s) => total + s.items.length, 0);
}
