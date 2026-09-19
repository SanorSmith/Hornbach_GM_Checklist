import type { AnswerMode, AnswerValue, GmRulesInput, Severity } from './schema';

/** A template resolved for evaluation: sections, items and merged rules. */
export interface ResolvedSection {
  id: string;
  sortIndex: number;
  titleSv: string;
  titleEn?: string;
  noteSv?: string;
  /** The GPL list's time blocks: "Morgon 08:00-12:00". */
  windowStart?: string;
  windowEnd?: string;
  /** 2 marks the evening list's "Checklista Person 2" sub-list. */
  assigneeSlot: number;
  slotLabelSv?: string;
  rules?: GmRulesInput;
}

export interface ResolvedItem {
  id: string;
  /** Stable across versions; reporting joins on this. */
  code: string;
  sectionId: string;
  controlGroupId?: string;
  sortIndex: number;
  /** Displayed number within its section, as printed on the paper form. */
  ordinal: string;
  textSv: string;
  textEn?: string;
  helpSv?: string;
  answerMode: AnswerMode;
  rules: GmRulesInput;
}

export interface ResolvedControlGroup {
  id: string;
  sortIndex: number;
  labelSv: string;
  requiresAfterControl: boolean;
}

export interface ResolvedTemplate {
  code: string;
  version: number;
  nameSv: string;
  nameEn?: string;
  shift: 'MORNING' | 'MIDDAY' | 'EVENING' | 'FULL_DAY';
  /** "OBS! Om nej, Skriv ej 'hinner inte'…" — printed under every run. */
  footerNotesSv?: string;
  /** Inherited by every section and item unless overridden. */
  defaults?: GmRulesInput;
  controlGroups: ResolvedControlGroup[];
  sections: ResolvedSection[];
  items: ResolvedItem[];
}

/** What the worker has entered so far for one point. */
export interface RunItemState {
  itemId: string;
  answer?: AnswerValue | null;
  answerCode?: string | null;
  note?: string | null;
  fields?: Record<string, string | number | null>;
  /** Total attached photos, and per named group for the 2+2 case. */
  photoCount?: number;
  photoCountsByGroup?: Record<string, number>;
  answeredAt?: string | null;
}

export interface RunContext {
  businessDate: string;
  shift: 'MORNING' | 'MIDDAY' | 'EVENING' | 'FULL_DAY';
  timeZone: string;
  /** ISO instants bounding the shift; `relativeDue` anchors to these. */
  shiftStartAt?: string;
  shiftEndAt?: string;
  openedAt?: string;
}

export type ItemStatus =
  | 'PENDING'
  | 'BLOCKED'
  | 'LOCKED'
  | 'ANSWERED'
  | 'NOT_APPLICABLE'
  | 'HIDDEN';

export interface ValidationIssue {
  code:
    | 'ANSWER_REQUIRED'
    | 'ANSWER_NOT_ALLOWED'
    | 'CODE_REQUIRED'
    | 'NOTE_REQUIRED'
    | 'NOTE_TOO_SHORT'
    | 'NOTE_BANNED'
    | 'PHOTO_REQUIRED'
    | 'PHOTO_GROUP_REQUIRED'
    | 'FIELD_REQUIRED'
    | 'FIELD_OUT_OF_RANGE';
  messageSv: string;
  /** Set when the issue belongs to a specific extra field or photo group. */
  key?: string;
}

export interface PlannedReminder {
  fireAt: string;
  severity: Severity;
  fullScreen: boolean;
  /** Deterministic, so reconciling the plan is idempotent. */
  dedupeKey: string;
}

export interface PlannedEscalation {
  fireAt: string;
  trigger: 'OVERDUE' | 'ANSWER_NEJ' | 'ANSWER_INGET_BEHOV';
  dedupeKey: string;
}

export interface ItemEvaluation {
  itemId: string;
  code: string;
  status: ItemStatus;
  visible: boolean;
  dueAt: string | null;
  windowStartAt: string | null;
  windowEndAt: string | null;
  /** Why the deadline is what it is, e.g. "Helg" — shown to the worker. */
  dueReasonSv?: string;
  isLate: boolean;
  blockedBy: string[];
  blockedMessageSv?: string;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  reminderPlan: PlannedReminder[];
  escalationPlan: PlannedEscalation[];
}

export interface RunEvaluation {
  canSubmit: boolean;
  /** The "special booking sequence": the order the worker is walked through. */
  orderedItemIds: string[];
  byItem: Record<string, ItemEvaluation>;
  progress: {
    total: number;
    applicable: number;
    answered: number;
    overdue: number;
    notApplicable: number;
    blocked: number;
  };
}
