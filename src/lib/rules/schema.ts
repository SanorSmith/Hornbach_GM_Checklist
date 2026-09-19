import { z } from 'zod';

/**
 * The rules document — one per checklist point, stored as JSON.
 *
 * Rules are DATA, not code. Everything the paper forms encode (a deadline, a
 * weekend variant, "alltid skicka bild", "endast om 6-7 stuv finns", the ban on
 * writing "hinner inte") lives here and is edited by an administrator, so a
 * fifth checklist never needs a developer.
 *
 * The condition language is deliberately small — only the operators the four
 * real lists actually need. Every request to add another one should be weighed
 * against this becoming a programming language nobody can debug.
 */

const TIME = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Expected a 24-hour time like "08:30"');

export const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'] as const;
export const weekdaySchema = z.enum(WEEKDAYS);
export type Weekday = z.infer<typeof weekdaySchema>;

export const answerValueSchema = z.enum(['JA', 'NEJ', 'INGET_BEHOV']);
export type AnswerValue = z.infer<typeof answerValueSchema>;

export const answerModeSchema = z.enum([
  'JA_NEJ',
  'JA_NEJ_INGET_BEHOV',
  'CODED',
  'NUMERIC_ONLY',
]);

export const severitySchema = z.enum(['info', 'warn', 'alarm']);
export type Severity = z.infer<typeof severitySchema>;

/* -------------------------------------------------------------------------- */
/* Condition AST                                                              */
/* -------------------------------------------------------------------------- */

/** Where a condition reads its left-hand value from. */
export const operandSchema = z.union([
  z.object({
    ref: z.literal('field'),
    /** 'SELF' means a field on this same item. */
    item: z.string().default('SELF'),
    key: z.string(),
  }),
  z.object({ ref: z.literal('answer'), item: z.string() }),
  z.object({ ref: z.literal('now') }),
  z.object({ ref: z.literal('run'), key: z.enum(['shift', 'business_date', 'weekday']) }),
  z.object({ ref: z.literal('const'), value: z.union([z.string(), z.number(), z.boolean()]) }),
]);
export type Operand = z.infer<typeof operandSchema>;

export type Condition =
  | { op: 'and'; of: Condition[] }
  | { op: 'or'; of: Condition[] }
  | { op: 'not'; of: Condition }
  | { op: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'; left: Operand; right: Operand }
  | { op: 'between'; left: Operand; min: number; max: number }
  | { op: 'in'; left: Operand; values: (string | number)[] }
  | { op: 'answered'; item: string }
  | { op: 'answer_is'; item: string; values: AnswerValue[] }
  | { op: 'weekday_in'; values: Weekday[] };

export const conditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.union([
    z.object({ op: z.literal('and'), of: z.array(conditionSchema) }),
    z.object({ op: z.literal('or'), of: z.array(conditionSchema) }),
    z.object({ op: z.literal('not'), of: conditionSchema }),
    z.object({
      op: z.enum(['eq', 'neq', 'gt', 'gte', 'lt', 'lte']),
      left: operandSchema,
      right: operandSchema,
    }),
    z.object({ op: z.literal('between'), left: operandSchema, min: z.number(), max: z.number() }),
    z.object({
      op: z.literal('in'),
      left: operandSchema,
      values: z.array(z.union([z.string(), z.number()])),
    }),
    z.object({ op: z.literal('answered'), item: z.string() }),
    z.object({ op: z.literal('answer_is'), item: z.string(), values: z.array(answerValueSchema) }),
    z.object({ op: z.literal('weekday_in'), values: z.array(weekdaySchema) }),
  ]),
);

/* -------------------------------------------------------------------------- */
/* Rule sections                                                              */
/* -------------------------------------------------------------------------- */

export const answerRulesSchema = z.object({
  mode: answerModeSchema.optional(),
  allowIngetBehov: z.boolean().optional(),
  /** CODED mode: the "Skriv F … eller B" case. */
  codes: z
    .array(z.object({ value: z.string().min(1).max(4), labelSv: z.string(), labelEn: z.string().optional() }))
    .optional(),
  /** The Container section's "skicka en bild till mejlet om inget behov". */
  onIngetBehov: z
    .object({
      requiresPhoto: z.boolean().optional(),
      minPhotos: z.number().int().min(0).optional(),
      requiresNote: z.boolean().optional(),
    })
    .optional(),
});

export const timingVariantSchema = z.object({
  when: z.object({ weekdayIn: z.array(weekdaySchema) }),
  dueTime: TIME,
  reasonSv: z.string().optional(),
});

export const timingRulesSchema = z.object({
  /** Wall-clock on the run's business date, in the store's zone. */
  dueTime: TIME.optional(),
  /** +1 for a deadline that falls after midnight. */
  dayOffset: z.number().int().min(0).max(1).optional(),
  windowStart: TIME.optional(),
  windowEnd: TIME.optional(),
  graceMinutes: z.number().int().min(0).max(120).optional(),
  /** First match wins — this is the "19:00, eller 17:00 på helgerna" case. */
  variants: z.array(timingVariantSchema).optional(),
  /** "minst 15 min innan hemgång" — anchored to the shift, not the clock. */
  relativeDue: z
    .object({
      anchor: z.enum(['shift_start', 'shift_end', 'run_open']),
      offsetMinutes: z.number().int(),
    })
    .optional(),
});

export const sequenceRulesSchema = z.object({
  orderIndex: z.number().int().optional(),
  /** Hard prerequisites: this point stays BLOCKED until they are answered. */
  requiresItems: z.array(z.string()).optional(),
  requiresAnswer: z.record(z.string(), z.array(answerValueSchema)).optional(),
  /** Ordering hint only; never blocks. */
  softAfter: z.array(z.string()).optional(),
  blocksSubmit: z.boolean().optional(),
  /** Not even offered before this time. */
  unlockAt: TIME.optional(),
});

export const photoGroupSchema = z.object({
  key: z.string(),
  labelSv: z.string(),
  labelEn: z.string().optional(),
  minCount: z.number().int().min(1),
});

export const evidenceRulesSchema = z.object({
  photo: z
    .object({
      required: z.enum(['always', 'if_answer', 'never']).optional(),
      ifAnswer: z.array(answerValueSchema).optional(),
      minCount: z.number().int().min(0).optional(),
      maxCount: z.number().int().min(1).optional(),
      hintSv: z.string().optional(),
      /** The "2 bilder GM-golv + 2 bilder GM-gård" case. */
      groups: z.array(photoGroupSchema).optional(),
    })
    .optional(),
  note: z
    .object({
      requiredIfAnswer: z.array(answerValueSchema).optional(),
      minLength: z.number().int().min(0).optional(),
      /**
       * The paper says: OBS! Om nej, Skriv ej "hinner inte", skriv bara varför.
       * Enforcing that is the whole point — a reason that explains nothing is
       * what made the paper process unauditable.
       */
      bannedPatterns: z.array(z.string()).optional(),
      bannedMessageSv: z.string().optional(),
      placeholderSv: z.string().optional(),
    })
    .optional(),
});

export const fieldRuleSchema = z.object({
  key: z.string(),
  type: z.enum(['INTEGER', 'DECIMAL', 'TEXT', 'PERSON_REF', 'TIME']),
  labelSv: z.string(),
  labelEn: z.string().optional(),
  requiredIfAnswer: z.array(answerValueSchema).optional(),
  min: z.number().optional(),
  max: z.number().optional(),
  maxLength: z.number().int().optional(),
  violationMessageSv: z.string().optional(),
});

export const visibilityRulesSchema = z.object({
  condition: conditionSchema,
  whenFalse: z.enum(['NOT_APPLICABLE', 'HIDDEN']).default('NOT_APPLICABLE'),
  explainSv: z.string().optional(),
});

export const escalationRulesSchema = z.object({
  on: z.array(z.enum(['OVERDUE', 'ANSWER_NEJ', 'ANSWER_INGET_BEHOV'])),
  delayMinutes: z.number().int().min(0).default(0),
  targets: z.array(
    z.union([
      z.object({ type: z.literal('ROLE'), value: z.enum(['GROUP_LEADER', 'ADMIN']) }),
      z.object({ type: z.literal('NEXT_SHIFT_PRIMARY') }),
      z.object({ type: z.literal('EMAIL'), value: z.string() }),
    ]),
  ),
  messageSv: z.string().optional(),
  autoExpireMinutes: z.number().int().optional(),
});

export const reminderRuleSchema = z.object({
  offsetMinutes: z.number().int(),
  severity: severitySchema,
  fullScreen: z.boolean().optional(),
  repeatEveryMinutes: z.number().int().min(1).optional(),
  maxRepeats: z.number().int().min(1).optional(),
});

export const gmRulesSchema = z.object({
  v: z.literal(1).default(1),
  answer: answerRulesSchema.optional(),
  timing: timingRulesSchema.optional(),
  sequence: sequenceRulesSchema.optional(),
  evidence: evidenceRulesSchema.optional(),
  fields: z.array(fieldRuleSchema).optional(),
  visibility: visibilityRulesSchema.optional(),
  escalation: escalationRulesSchema.optional(),
  handover: z
    .object({
      toShift: z.enum(['MORNING', 'MIDDAY', 'EVENING', 'FULL_DAY']),
      createsHandoverRecord: z.boolean().default(true),
      personField: z.string().optional(),
    })
    .optional(),
  reminders: z.array(reminderRuleSchema).optional(),
  meta: z.record(z.string(), z.unknown()).optional(),
});

/** The PARSED shape, after defaults are applied. What the engine consumes. */
export type GmRules = z.infer<typeof gmRulesSchema>;

/**
 * The AUTHORING shape, before defaults are applied — `v` and other defaulted
 * keys are optional. Seeds, fixtures and the template builder write this;
 * `mergeRules` turns it into `GmRules`.
 */
export type GmRulesInput = z.input<typeof gmRulesSchema>;
export type TimingRules = z.infer<typeof timingRulesSchema>;
export type FieldRule = z.infer<typeof fieldRuleSchema>;
export type PhotoGroup = z.infer<typeof photoGroupSchema>;
export type ReminderRule = z.infer<typeof reminderRuleSchema>;
export type AnswerMode = z.infer<typeof answerModeSchema>;
