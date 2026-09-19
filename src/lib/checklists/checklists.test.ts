import { describe, expect, it } from 'vitest';
import { CHECKLIST_CATALOGUE, findChecklist } from './index';

describe('checklist catalogue', () => {
  it('covers all four paper lists', () => {
    expect(CHECKLIST_CATALOGUE).toHaveLength(4);
    expect(CHECKLIST_CATALOGUE.map((c) => c.code)).toEqual([
      'GM_LF_MORGON',
      'GM_DORR',
      'GM_GPL',
      'GM_LF_KVALL',
    ]);
  });

  it('uses unique template codes, since reporting joins on them', () => {
    const codes = new Set(CHECKLIST_CATALOGUE.map((c) => c.code));
    expect(codes.size).toBe(CHECKLIST_CATALOGUE.length);
  });

  it('counts the evening list including its Person 2 sub-list', () => {
    // 4 in the first block + 11 in the second + 5 for Person 2.
    expect(findChecklist('GM_LF_KVALL')?.itemCount).toBe(20);
  });

  it('points every entry at an archived source file', () => {
    for (const list of CHECKLIST_CATALOGUE) {
      expect(list.sourceFile).toMatch(/\.xls$/);
      expect(list.itemCount).toBeGreaterThan(0);
    }
  });

  it('returns undefined for an unknown code', () => {
    expect(findChecklist('NOPE')).toBeUndefined();
  });
});
