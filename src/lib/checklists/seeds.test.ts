import { describe, expect, it } from 'vitest';
import { CHECKLIST_CATALOGUE, TEMPLATE_SEEDS, getTemplate } from './index';
import { compileNotePattern } from '@/lib/rules/evaluate';
import { evaluateRun } from '@/lib/rules';
import { mergeRules } from '@/lib/rules/merge';
import { gmRulesSchema } from '@/lib/rules/schema';
import type { Condition, Operand } from '@/lib/rules/schema';

/**
 * Integrity of the four shipped checklists.
 *
 * These are transcriptions of paper forms people's jobs depend on. A
 * prerequisite pointing at a code that does not exist, or a banned-word pattern
 * that silently fails to compile, would leave a rule looking configured while
 * doing nothing — so it is checked here rather than discovered on a shift.
 */

/** Counted from the original .xls files. */
const EXPECTED_COUNTS: Record<string, number> = {
  GM_LF_MORGON: 18,
  GM_DORR: 14,
  GM_GPL: 23,
  GM_LF_KVALL: 20,
};

const allCodes = new Set(
  TEMPLATE_SEEDS.flatMap((seed) => getTemplate(seed.code)?.items.map((i) => i.code) ?? []),
);

function operandTargets(operand: Operand): string[] {
  if (operand.ref === 'field' && operand.item !== 'SELF') return [operand.item];
  if (operand.ref === 'answer') return [operand.item];
  return [];
}

function conditionTargets(condition: Condition): string[] {
  switch (condition.op) {
    case 'and':
    case 'or':
      return condition.of.flatMap(conditionTargets);
    case 'not':
      return conditionTargets(condition.of);
    case 'eq':
    case 'neq':
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
      return [...operandTargets(condition.left), ...operandTargets(condition.right)];
    case 'between':
    case 'in':
      return operandTargets(condition.left);
    case 'answered':
    case 'answer_is':
      return [condition.item];
    default:
      return [];
  }
}

describe.each(TEMPLATE_SEEDS.map((s) => [s.code, s] as const))('%s', (code, seed) => {
  const template = getTemplate(code)!;

  it('resolves', () => {
    expect(template).toBeDefined();
    expect(template.version).toBeGreaterThan(0);
  });

  it('has exactly the number of points the paper form has', () => {
    expect(template.items).toHaveLength(EXPECTED_COUNTS[code]!);
  });

  it('gives every point a unique, stable code', () => {
    const codes = template.items.map((i) => i.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const itemCode of codes) expect(itemCode.startsWith(`${code}.`)).toBe(true);
  });

  it('has Swedish text on every point — the source of truth', () => {
    for (const item of template.items) {
      expect(item.textSv.trim().length).toBeGreaterThan(10);
    }
  });

  it('produces rules that satisfy the schema once merged', () => {
    for (const item of template.items) {
      const section = template.sections.find((s) => s.id === item.sectionId);
      const merged = mergeRules(template.defaults, section?.rules, item.rules);
      expect(gmRulesSchema.safeParse(merged).success).toBe(true);
    }
  });

  it('only references points that exist', () => {
    for (const item of template.items) {
      const rules = item.rules;
      const referenced = [
        ...(rules.sequence?.requiresItems ?? []),
        ...Object.keys(rules.sequence?.requiresAnswer ?? {}),
        ...(rules.sequence?.softAfter ?? []),
        ...(rules.visibility ? conditionTargets(rules.visibility.condition as Condition) : []),
      ];
      for (const target of referenced) {
        expect(allCodes.has(target), `${item.code} references missing ${target}`).toBe(true);
      }
    }
  });

  it('only references control groups that exist', () => {
    const groupIds = new Set(template.controlGroups.map((g) => g.id));
    for (const item of template.items) {
      if (item.controlGroupId) expect(groupIds.has(item.controlGroupId)).toBe(true);
    }
  });

  it('has banned-note patterns that actually compile', () => {
    for (const item of template.items) {
      const section = template.sections.find((s) => s.id === item.sectionId);
      const merged = mergeRules(template.defaults, section?.rules, item.rules);
      for (const pattern of merged.evidence?.note?.bannedPatterns ?? []) {
        expect(compileNotePattern(pattern), `pattern "${pattern}" does not compile`).not.toBeNull();
      }
    }
  });

  it('evaluates end to end on a weekday and a weekend without throwing', () => {
    for (const businessDate of ['2026-09-21', '2026-09-19']) {
      const result = evaluateRun({
        template,
        run: {
          businessDate,
          shift: template.shift,
          timeZone: 'Europe/Stockholm',
          shiftStartAt: `${businessDate}T05:00:00.000Z`,
          shiftEndAt: `${businessDate}T16:00:00.000Z`,
        },
        items: [],
        now: new Date(`${businessDate}T06:00:00.000Z`),
      });

      expect(result.orderedItemIds).toHaveLength(template.items.length);
      // Nothing is answered yet, so an empty run can never be signed.
      expect(result.canSubmit).toBe(false);
    }
  });

  it('matches the catalogue entry shown on the picker', () => {
    const summary = CHECKLIST_CATALOGUE.find((c) => c.code === code);
    expect(summary?.itemCount).toBe(EXPECTED_COUNTS[code]);
    expect(summary?.nameSv).toBe(seed.nameSv);
  });
});

describe('rules carried over from the printed forms', () => {
  it('bans "hinner inte" on every point of every list', () => {
    for (const seed of TEMPLATE_SEEDS) {
      const template = getTemplate(seed.code)!;
      for (const item of template.items) {
        const section = template.sections.find((s) => s.id === item.sectionId);
        const merged = mergeRules(template.defaults, section?.rules, item.rules);
        const patterns = merged.evidence?.note?.bannedPatterns ?? [];
        const catchesIt = patterns.some((p) => compileNotePattern(p)?.test('vi hinner inte'));
        expect(catchesIt, `${item.code} does not ban "hinner inte"`).toBe(true);
      }
    }
  });

  it('gives the GPL list no "Inget behov" option, as its form has no such column', () => {
    const template = getTemplate('GM_GPL')!;
    for (const item of template.items) {
      const merged = mergeRules(template.defaults, undefined, item.rules);
      expect(merged.answer?.allowIngetBehov).toBe(false);
      expect(merged.answer?.mode).toBe('JA_NEJ');
    }
  });

  it('keeps the evening list\'s Person 2 sub-list on its own signature slot', () => {
    const template = getTemplate('GM_LF_KVALL')!;
    const person2 = template.sections.find((s) => s.assigneeSlot === 2);
    expect(person2?.titleSv).toBe('Checklista Person 2');
    expect(template.items.filter((i) => i.sectionId === person2?.id)).toHaveLength(5);
  });

  it('applies the weekend deadline to the delivery-note point', () => {
    const template = getTemplate('GM_LF_KVALL')!;
    const run = (businessDate: string) =>
      evaluateRun({
        template,
        run: { businessDate, shift: 'EVENING', timeZone: 'Europe/Stockholm' },
        items: [],
        now: new Date(`${businessDate}T10:00:00.000Z`),
      }).byItem['GM_LF_KVALL.GARD.09'];

    // Monday: 19:00 local. Saturday: 17:00 local.
    expect(run('2026-09-21')?.dueAt).toBe('2026-09-21T17:00:00.000Z');
    expect(run('2026-09-19')?.dueAt).toBe('2026-09-19T15:00:00.000Z');
    expect(run('2026-09-19')?.dueReasonSv).toContain('Helg');
  });

  it('requires 2+2 photos before going home on the evening list', () => {
    const template = getTemplate('GM_LF_KVALL')!;
    const result = evaluateRun({
      template,
      run: {
        businessDate: '2026-09-21',
        shift: 'EVENING',
        timeZone: 'Europe/Stockholm',
        shiftEndAt: '2026-09-21T18:00:00.000Z',
      },
      items: [
        {
          itemId: 'GM_LF_KVALL.GARD.11',
          answer: 'JA',
          photoCount: 2,
          photoCountsByGroup: { golv: 2, gard: 0 },
        },
      ],
      now: new Date('2026-09-21T17:00:00.000Z'),
    });

    const evaluation = result.byItem['GM_LF_KVALL.GARD.11'];
    expect(evaluation?.dueAt).toBe('2026-09-21T17:45:00.000Z');
    expect(evaluation?.errors.map((e) => e.key)).toContain('gard');
  });

  it('hides the soil-pallet booking until the stack count says 6-7', () => {
    const template = getTemplate('GM_LF_MORGON')!;
    const withCount = (antal: number) =>
      evaluateRun({
        template,
        run: { businessDate: '2026-09-21', shift: 'MORNING', timeZone: 'Europe/Stockholm' },
        items: [{ itemId: 'GM_LF_MORGON.PALL.02', answer: 'JA', fields: { antal_stuva: antal } }],
        now: new Date('2026-09-21T09:00:00.000Z'),
      }).byItem['GM_LF_MORGON.PALL.03']?.status;

    expect(withCount(3)).toBe('NOT_APPLICABLE');
    expect(withCount(6)).toBe('PENDING');
    expect(withCount(7)).toBe('PENDING');
    expect(withCount(9)).toBe('NOT_APPLICABLE');
  });
});
