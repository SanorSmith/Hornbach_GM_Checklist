import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { answerValue, controlStatus, fieldType, itemStatus, runStatus, shiftCode } from './enums';
import { users } from './identity';
import { stores } from './stores';

/**
 * One performance of one checklist, on one day, by one person.
 *
 * `templateCode` + `templateVersion` pin the exact template the run was
 * performed against. Templates ship as versioned, immutable seeds, so editing a
 * checklist means publishing version N+1 — a completed run can never be
 * retroactively rewritten by a later edit, which is what makes the signature
 * mean anything.
 */
export const checklistRuns = pgTable(
  'checklist_runs',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    templateCode: text('template_code').notNull(),
    templateVersion: integer('template_version').notNull(),
    businessDate: date('business_date').notNull(),
    shift: shiftCode('shift').notNull(),
    status: runStatus('status').notNull().default('OPEN'),
    openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    createdBy: uuid('created_by').references(() => users.id),

    /**
     * Efterkontroll — the group leader's review of a finished list.
     *
     * PENDING until someone reviews it, so "submitted but nobody has checked
     * it" is a state the system can see rather than an absence. The reviewer's
     * signature is a row in `signatures` with purpose 'LEADER_CONTROL'; these
     * columns are the verdict, kept on the run so it can be filtered and
     * counted without joining.
     */
    controlStatus: controlStatus('control_status').notNull().default('PENDING'),
    controlledBy: uuid('controlled_by').references(() => users.id),
    controlledAt: timestamp('controlled_at', { withTimezone: true }),
    /** Why, when the verdict is not OK. Required by the API in that case. */
    controlNote: text('control_note'),
  },
  (t) => [
    // One run per list per day per shift — two people opening the morning list
    // must land on the same run, not two half-finished ones.
    uniqueIndex('runs_unique_per_day').on(
      t.storeId,
      t.templateCode,
      t.businessDate,
      t.shift,
    ),
    index('runs_by_date_idx').on(t.storeId, t.businessDate),
  ],
);

export const runItems = pgTable(
  'run_items',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    runId: uuid('run_id')
      .notNull()
      .references(() => checklistRuns.id, { onDelete: 'cascade' }),
    /** The template item's stable code. Reporting joins on this. */
    itemCode: text('item_code').notNull(),
    assigneeSlot: smallint('assignee_slot').notNull().default(1),
    status: itemStatus('status').notNull().default('PENDING'),
    answer: answerValue('answer'),
    /** The "Skriv F … eller B" answer. */
    answerCode: text('answer_code'),
    note: text('note'),
    /** Resolved by the engine at run creation and then frozen, so a later
        template edit cannot move a deadline that has already passed. */
    dueAt: timestamp('due_at', { withTimezone: true }),
    isLate: boolean('is_late'),
    answeredBy: uuid('answered_by').references(() => users.id),
    answeredAt: timestamp('answered_at', { withTimezone: true }),
    /** The device's clock; on-time reporting uses this, with skew detection. */
    clientAnsweredAt: timestamp('client_answered_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('run_items_unique').on(t.runId, t.itemCode),
    index('run_items_code_idx').on(t.itemCode),
  ],
);

/**
 * The extra data a point carries: "Antal Stuva", "Antal Bilar" + "Gods typ",
 * "Lämnades Till". One row per field, so a point needing two numbers needs no
 * schema change.
 */
export const runItemFieldValues = pgTable(
  'run_item_field_values',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    runItemId: uuid('run_item_id')
      .notNull()
      .references(() => runItems.id, { onDelete: 'cascade' }),
    fieldKey: text('field_key').notNull(),
    fieldType: fieldType('field_type').notNull(),
    valueText: text('value_text'),
    valueNumeric: numeric('value_numeric'),
    valueUserId: uuid('value_user_id').references(() => users.id),
  },
  (t) => [uniqueIndex('run_item_field_unique').on(t.runItemId, t.fieldKey)],
);

/**
 * "Genomförs av", made tamper-evident.
 *
 * `username` and `displayName` are frozen copies — a later rename must not
 * change who signed. `snapshot` holds the canonical run as signed, and the two
 * hashes let anyone prove it has not been altered since.
 */
export const signatures = pgTable(
  'signatures',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    runId: uuid('run_id')
      .notNull()
      .references(() => checklistRuns.id, { onDelete: 'cascade' }),
    /** 2 is the evening list's "Person 2". */
    slot: smallint('slot').notNull().default(1),
    purpose: text('purpose').notNull().default('WORKER_SUBMIT'),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    signedAt: timestamp('signed_at', { withTimezone: true }).notNull().defaultNow(),
    deviceLabel: text('device_label'),
    contentHash: text('content_hash').notNull(),
    signatureHash: text('signature_hash').notNull(),
    snapshot: jsonb('snapshot').notNull(),
  },
  (t) => [uniqueIndex('signature_unique').on(t.runId, t.slot, t.purpose)],
);

export type ChecklistRun = typeof checklistRuns.$inferSelect;
export type RunItemRow = typeof runItems.$inferSelect;
export type SignatureRow = typeof signatures.$inferSelect;
