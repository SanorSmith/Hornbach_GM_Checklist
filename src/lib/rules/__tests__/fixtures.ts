import type { GmRulesInput } from '../schema';
import type { ResolvedItem, ResolvedSection, ResolvedTemplate, RunContext } from '../types';

export const TZ = 'Europe/Stockholm';

export function section(
  id: string,
  overrides: Partial<ResolvedSection> = {},
): ResolvedSection {
  return {
    id,
    sortIndex: 0,
    titleSv: id,
    assigneeSlot: 1,
    ...overrides,
  };
}

export function item(
  code: string,
  rules: GmRulesInput,
  overrides: Partial<ResolvedItem> = {},
): ResolvedItem {
  return {
    id: `id-${code}`,
    code,
    sectionId: 's1',
    sortIndex: 0,
    ordinal: '1',
    textSv: `Punkt ${code}`,
    answerMode: 'JA_NEJ_INGET_BEHOV',
    rules,
    ...overrides,
  };
}

export function template(
  items: ResolvedItem[],
  overrides: Partial<ResolvedTemplate> = {},
): ResolvedTemplate {
  return {
    code: 'TEST',
    version: 1,
    nameSv: 'Testlista',
    shift: 'MORNING',
    controlGroups: [],
    sections: [section('s1')],
    items,
    ...overrides,
  };
}

/** A Monday. Deliberately not a weekend, so variant tests are explicit. */
export function runOn(businessDate = '2026-09-21', overrides: Partial<RunContext> = {}): RunContext {
  return {
    businessDate,
    shift: 'MORNING',
    timeZone: TZ,
    ...overrides,
  };
}
