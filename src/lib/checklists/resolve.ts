import type { ResolvedItem, ResolvedSection, ResolvedTemplate } from '@/lib/rules/types';
import { itemCode, type TemplateSeed } from '@/../seeds/types';

/**
 * Turns an authored template seed into the shape the rules engine evaluates.
 *
 * Item ids are derived from the stable `code` rather than generated, so the
 * same point keeps the same identity across restarts and across the demo and
 * live repositories. Reporting joins on `code` for the same reason: it survives
 * a new template version, a row id would not.
 */
export function resolveTemplate(seed: TemplateSeed): ResolvedTemplate {
  const sections: ResolvedSection[] = [];
  const items: ResolvedItem[] = [];

  seed.sections.forEach((section, sectionIndex) => {
    const sectionId = `${seed.code}.${section.key}`;

    sections.push({
      id: sectionId,
      sortIndex: sectionIndex,
      titleSv: section.titleSv,
      ...(section.titleEn ? { titleEn: section.titleEn } : {}),
      ...(section.noteSv ? { noteSv: section.noteSv } : {}),
      ...(section.windowStart ? { windowStart: section.windowStart } : {}),
      ...(section.windowEnd ? { windowEnd: section.windowEnd } : {}),
      assigneeSlot: section.assigneeSlot ?? 1,
      ...(section.slotLabelSv ? { slotLabelSv: section.slotLabelSv } : {}),
      ...(section.rules ? { rules: section.rules } : {}),
    });

    section.items.forEach((item, itemIndex) => {
      const code = itemCode(seed.code, section.key, item.ordinal);
      items.push({
        id: code,
        code,
        sectionId,
        sortIndex: sectionIndex * 100 + itemIndex,
        ordinal: item.ordinal,
        textSv: item.textSv,
        ...(item.textEn ? { textEn: item.textEn } : {}),
        ...(item.helpSv ? { helpSv: item.helpSv } : {}),
        ...(item.controlGroup
          ? { controlGroupId: `${seed.code}.${item.controlGroup}` }
          : {}),
        answerMode:
          item.rules?.answer?.mode ?? seed.defaults?.answer?.mode ?? 'JA_NEJ_INGET_BEHOV',
        rules: item.rules ?? {},
      });
    });
  });

  return {
    code: seed.code,
    version: seed.version,
    nameSv: seed.nameSv,
    nameEn: seed.nameEn,
    shift: seed.shift,
    ...(seed.footerNotesSv ? { footerNotesSv: seed.footerNotesSv } : {}),
    ...(seed.defaults ? { defaults: seed.defaults } : {}),
    controlGroups: seed.controlGroups.map((group, index) => ({
      id: `${seed.code}.${group.key}`,
      sortIndex: index,
      labelSv: group.labelSv,
      requiresAfterControl: true,
    })),
    sections,
    items,
  };
}
