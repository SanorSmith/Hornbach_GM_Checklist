import type { AttachmentMeta, RunItemStateRecord } from '@/lib/repo/types';
import type { ResolvedTemplate, RunItemState } from '@/lib/rules/types';

/**
 * Builds the engine's input from stored answers and attachments.
 *
 * This exists in one place on purpose. The server briefly built this mapping
 * itself and forgot the photo counts, so every photo-required point was
 * permanently unsignable while the browser — which did count them — insisted
 * the list was complete. Same engine, different inputs, opposite answers.
 *
 * Both callers now go through here, so that particular disagreement cannot
 * come back.
 */
export function toEngineItems(
  template: ResolvedTemplate,
  answers: readonly RunItemStateRecord[],
  attachments: readonly AttachmentMeta[],
): RunItemState[] {
  const stateByCode = new Map(answers.map((a) => [a.itemCode, a]));

  const photosByItem = new Map<string, { total: number; groups: Record<string, number> }>();
  for (const attachment of attachments) {
    const entry = photosByItem.get(attachment.itemCode) ?? { total: 0, groups: {} };
    entry.total += 1;
    if (attachment.groupKey) {
      entry.groups[attachment.groupKey] = (entry.groups[attachment.groupKey] ?? 0) + 1;
    }
    photosByItem.set(attachment.itemCode, entry);
  }

  return template.items.map((item) => {
    const state = stateByCode.get(item.code);
    const photos = photosByItem.get(item.code);
    return {
      itemId: item.code,
      answer: state?.answer ?? null,
      answerCode: state?.answerCode ?? null,
      note: state?.note ?? null,
      fields: state?.fields ?? {},
      answeredAt: state?.answeredAt ?? null,
      photoCount: photos?.total ?? 0,
      photoCountsByGroup: photos?.groups ?? {},
    };
  });
}
