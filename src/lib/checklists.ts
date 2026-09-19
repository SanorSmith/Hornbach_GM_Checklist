/**
 * The four paper checklists this system replaces, as decoded from the originals
 * archived in `docs/source-checklists/`.
 *
 * This is catalogue metadata only — titles, roles and shape. The actual items,
 * deadlines and rules live in versioned template seeds under `seeds/templates/`
 * and are loaded from the database at runtime, so that a completed run always
 * pins the exact template version it was performed against.
 */

export type ShiftCode = 'morning' | 'midday' | 'evening' | 'fullDay';

export interface ChecklistSummary {
  /** Stable template code. Reporting joins on this, never on a row id. */
  readonly code: string;
  readonly nameSv: string;
  readonly nameEn: string;
  /** Who performs it, in the store's own words. */
  readonly roleSv: string;
  readonly shift: ShiftCode;
  /** Number of answerable points, including any second-person sub-list. */
  readonly itemCount: number;
  /** The span of clock deadlines the list actually contains. */
  readonly windowSv: string;
  readonly sourceFile: string;
}

export const CHECKLIST_CATALOGUE: readonly ChecklistSummary[] = [
  {
    code: 'GM_LF_MORGON',
    nameSv: 'Checklista GM Linefeeder MORGON',
    nameEn: 'GM Linefeeder checklist — morning',
    roleSv: 'Linefeeder, morgonpass',
    shift: 'morning',
    itemCount: 18,
    windowSv: '07:00–15:00',
    sourceFile: 'Checklista_GM_Linefeeder_MORGON.xls',
  },
  {
    code: 'GM_DORR',
    nameSv: 'Checklista för GM-personal vid dörren',
    nameEn: 'Checklist for GM staff at the door',
    roleSv: 'GM-personal vid dörren',
    shift: 'fullDay',
    itemCount: 14,
    windowSv: 'Hela dagen',
    sourceFile: 'Checklista_GM-personal_vid_dorren.xls',
  },
  {
    code: 'GM_GPL',
    nameSv: 'Checklista GPL GM',
    nameEn: 'GM group leader checklist',
    roleSv: 'Gruppledare (GPL)',
    shift: 'fullDay',
    itemCount: 23,
    windowSv: '08:00–17:00',
    sourceFile: 'Checklista_GPL_GM.xls',
  },
  {
    code: 'GM_LF_KVALL',
    nameSv: 'Checklista GM Linefeeder KVÄLL',
    nameEn: 'GM Linefeeder checklist — evening',
    roleSv: 'Linefeeder, kvällspass (inkl. Person 2)',
    shift: 'evening',
    itemCount: 20,
    windowSv: '17:00–19:45',
    sourceFile: 'Checklista_GM_Linefeeder_KVALL.xls',
  },
] as const;

export function findChecklist(code: string): ChecklistSummary | undefined {
  return CHECKLIST_CATALOGUE.find((c) => c.code === code);
}
