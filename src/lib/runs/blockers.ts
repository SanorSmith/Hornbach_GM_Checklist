import type { ResolvedTemplate, RunEvaluation } from '@/lib/rules/types';

/**
 * Everything standing between the worker and a signature.
 *
 * Not the same as "unanswered". A point can be answered Ja and still block,
 * because it wants a photo, a note, or a number in range — so counting the
 * unanswered ones told a worker with every box ticked and one missing photo
 * that there were "0 punkter kvar" while the Signera button stayed dead. A
 * dead button with nothing to act on is the worst state this screen can be in:
 * the shift is ending, the list is done, and the app will not say why.
 *
 * Returned in the order the list is walked, so the first one is the next thing
 * to go and fix.
 */

export interface Blocker {
  code: string;
  /** The number printed against the point on the paper form. */
  ordinal: string;
  reasonSv: string;
}

export function listBlockers(
  template: ResolvedTemplate,
  evaluation: RunEvaluation,
): Blocker[] {
  const position = new Map(evaluation.orderedItemIds.map((id, index) => [id, index]));

  return template.items
    .filter((item) => (evaluation.byItem[item.id]?.errors.length ?? 0) > 0)
    .sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0))
    .map((item) => ({
      code: item.code,
      ordinal: item.ordinal,
      // The first issue is enough: fixing it re-runs the engine and the next
      // one surfaces. Listing all of them at once on a phone is a wall.
      reasonSv: evaluation.byItem[item.id]!.errors[0]!.messageSv,
    }));
}
