import { describe, expect, it } from 'vitest';
import { getTemplate } from '@/lib/checklists';
import { toEngineItems } from './engine-input';

const template = getTemplate('GM_LF_KVALL')!;

/**
 * Regression cover for a real bug: the sign endpoint built this mapping itself
 * and omitted photo counts, so photo-required points could never be signed
 * while the browser said the list was ready.
 */
describe('toEngineItems', () => {
  it('produces one entry per template point, even with nothing answered', () => {
    expect(toEngineItems(template, [], [])).toHaveLength(template.items.length);
  });

  it('carries photo counts through, in total and per group', () => {
    const items = toEngineItems(
      template,
      [{ itemCode: 'GM_LF_KVALL.GARD.11', answer: 'JA' }],
      [
        { id: '1', itemCode: 'GM_LF_KVALL.GARD.11', groupKey: 'golv', contentType: 'image/webp', byteSize: 1, uploadedAt: '' },
        { id: '2', itemCode: 'GM_LF_KVALL.GARD.11', groupKey: 'golv', contentType: 'image/webp', byteSize: 1, uploadedAt: '' },
        { id: '3', itemCode: 'GM_LF_KVALL.GARD.11', groupKey: 'gard', contentType: 'image/webp', byteSize: 1, uploadedAt: '' },
      ],
    );

    const entry = items.find((i) => i.itemId === 'GM_LF_KVALL.GARD.11');
    expect(entry?.photoCount).toBe(3);
    expect(entry?.photoCountsByGroup).toEqual({ golv: 2, gard: 1 });
  });

  it('reports zero photos rather than undefined, so rules compare cleanly', () => {
    const entry = toEngineItems(template, [], [])[0];
    expect(entry?.photoCount).toBe(0);
    expect(entry?.photoCountsByGroup).toEqual({});
  });

  it('ignores attachments belonging to other points', () => {
    const items = toEngineItems(template, [], [
      { id: '1', itemCode: 'GM_LF_KVALL.GARD.04', groupKey: null, contentType: 'image/webp', byteSize: 1, uploadedAt: '' },
    ]);
    expect(items.find((i) => i.itemId === 'GM_LF_KVALL.GARD.04')?.photoCount).toBe(1);
    expect(items.find((i) => i.itemId === 'GM_LF_KVALL.GARD.11')?.photoCount).toBe(0);
  });
});
