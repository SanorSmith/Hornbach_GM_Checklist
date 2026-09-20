import { describe, expect, it } from 'vitest';
import { getTemplate } from '@/lib/checklists';
import { evaluateRun } from '@/lib/rules';
import type { RunItemState } from '@/lib/rules/types';
import { listBlockers } from './blockers';

/**
 * The case that matters is the one that stranded a worker: every point
 * answered, the Signera button dead, and the screen reporting "0 punkter
 * kvar" because it only ever counted unanswered points.
 */

const CODE = 'GM_LF_MORGON';

function evaluate(items: RunItemState[]) {
  const template = getTemplate(CODE)!;
  return {
    template,
    evaluation: evaluateRun({
      template,
      run: { businessDate: '2026-09-21', shift: 'MORNING', timeZone: 'Europe/Stockholm' },
      items,
      now: new Date('2026-09-21T09:00:00.000Z'),
    }),
  };
}

const FIELDS: Record<string, Record<string, number>> = {
  'GM_LF_MORGON.CONT.06': { pallar_per_stuva: 20 },
  'GM_LF_MORGON.PALL.02': { antal_stuva: 6 },
  'GM_LF_MORGON.PALL.03': { antal_pallar: 12 },
};

/** Every point answered Ja, with the numbers each one needs — but no photos. */
function everythingAnsweredWithoutPhotos(): RunItemState[] {
  const template = getTemplate(CODE)!;
  return template.items.map((item) => ({
    itemId: item.id,
    answer: 'JA',
    answerCode: item.code === 'GM_LF_MORGON.BEL.08' ? 'F' : null,
    fields: FIELDS[item.code] ?? {},
  }));
}

describe('listBlockers', () => {
  it('is empty when the list can be signed', () => {
    const template = getTemplate(CODE)!;
    const items = everythingAnsweredWithoutPhotos().map((item) => ({
      ...item,
      photoCount: 2,
    }));
    const { evaluation } = evaluate(items);

    expect(evaluation.canSubmit).toBe(true);
    expect(listBlockers(template, evaluation)).toEqual([]);
  });

  it('reports points that are answered but still block, with the reason', () => {
    const { template, evaluation } = evaluate(everythingAnsweredWithoutPhotos());
    const blockers = listBlockers(template, evaluation);

    // The state that stranded the worker: nothing left unanswered, and the
    // button still dead.
    expect(evaluation.canSubmit).toBe(false);
    expect(evaluation.progress.answered).toBe(evaluation.progress.applicable);

    expect(blockers.length).toBeGreaterThan(0);
    expect(blockers.every((b) => b.reasonSv.length > 0)).toBe(true);
    expect(blockers[0]?.reasonSv).toMatch(/bild/i);
  });

  it('counts unanswered points too', () => {
    const { template, evaluation } = evaluate([]);
    const blockers = listBlockers(template, evaluation);

    expect(blockers.length).toBe(evaluation.progress.applicable);
    expect(blockers[0]?.reasonSv).toBe('Punkten måste besvaras.');
  });

  it('puts the first one to go and fix at the front', () => {
    const template = getTemplate(CODE)!;
    const { evaluation } = evaluate(everythingAnsweredWithoutPhotos());
    const blockers = listBlockers(template, evaluation);

    const position = new Map(evaluation.orderedItemIds.map((id, i) => [id, i]));
    const positions = blockers.map((b) => position.get(b.code) ?? -1);
    expect(positions).toEqual([...positions].sort((a, b) => a - b));

    // And it carries the number printed on the paper, so it can be found.
    expect(blockers[0]?.ordinal).toBe(
      template.items.find((i) => i.code === blockers[0]!.code)?.ordinal,
    );
  });

  it('leaves out a point the day does not apply to', () => {
    const template = getTemplate(CODE)!;
    // Fewer than six stacks: the jordpall booking is not applicable, so it is
    // not something standing in the worker's way.
    const { evaluation } = evaluate([
      { itemId: 'GM_LF_MORGON.PALL.02', answer: 'JA', fields: { antal_stuva: 3 } },
    ]);
    const blockers = listBlockers(template, evaluation);

    expect(blockers.some((b) => b.code === 'GM_LF_MORGON.PALL.03')).toBe(false);
  });
});
