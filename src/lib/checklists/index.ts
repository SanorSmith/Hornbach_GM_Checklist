import { TEMPLATE_SEEDS, type TemplateSeed } from '@/../seeds/templates';
import { countItems } from '@/../seeds/types';
import type { MessageKey } from '@/lib/i18n';
import type { ResolvedTemplate } from '@/lib/rules/types';
import { resolveTemplate } from './resolve';

export type ShiftCode = 'MORNING' | 'MIDDAY' | 'EVENING' | 'FULL_DAY';

export interface ChecklistSummary {
  readonly code: string;
  readonly nameSv: string;
  readonly nameEn: string;
  readonly roleSv: string;
  readonly shift: ShiftCode;
  /** Counted from the seed, so it can never drift from the actual content. */
  readonly itemCount: number;
  readonly windowSv: string;
  readonly sourceFile: string;
}

/** The span of clock deadlines a list actually contains, for the picker card. */
function deadlineWindow(seed: TemplateSeed): string {
  const times: string[] = [];
  for (const section of seed.sections) {
    if (section.windowStart) times.push(section.windowStart);
    if (section.windowEnd) times.push(section.windowEnd);
    for (const item of section.items) {
      const timing = item.rules?.timing;
      if (timing?.dueTime) times.push(timing.dueTime);
      for (const variant of timing?.variants ?? []) times.push(variant.dueTime);
    }
  }
  if (times.length === 0) return 'Hela dagen';
  const sorted = [...times].sort();
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return first === last ? first! : `${first}–${last}`;
}

export const CHECKLIST_CATALOGUE: readonly ChecklistSummary[] = TEMPLATE_SEEDS.map((seed) => ({
  code: seed.code,
  nameSv: seed.nameSv,
  nameEn: seed.nameEn,
  roleSv: seed.roleHintSv,
  shift: seed.shift,
  itemCount: countItems(seed),
  windowSv: deadlineWindow(seed),
  sourceFile: seed.sourceFile,
}));

/** Shift codes are stored in the database's spelling; labels live in i18n. */
export const SHIFT_MESSAGE_KEY = {
  MORNING: 'shift.morning',
  MIDDAY: 'shift.midday',
  EVENING: 'shift.evening',
  FULL_DAY: 'shift.fullDay',
} as const satisfies Record<ShiftCode, MessageKey>;

export function findChecklist(code: string): ChecklistSummary | undefined {
  return CHECKLIST_CATALOGUE.find((c) => c.code === code);
}

const resolved = new Map<string, ResolvedTemplate>();

/** The evaluated form of a template, resolved once per process. */
export function getTemplate(code: string): ResolvedTemplate | undefined {
  const cached = resolved.get(code);
  if (cached) return cached;

  const seed = TEMPLATE_SEEDS.find((s) => s.code === code);
  if (!seed) return undefined;

  const template = resolveTemplate(seed);
  resolved.set(code, template);
  return template;
}

export function getSeed(code: string): TemplateSeed | undefined {
  return TEMPLATE_SEEDS.find((s) => s.code === code);
}

export { TEMPLATE_SEEDS, resolveTemplate };
