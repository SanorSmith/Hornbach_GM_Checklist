import { sql } from 'drizzle-orm';
import { date, index, pgTable, smallint, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './identity';
import { stores } from './stores';

/**
 * Who is expected to do which checklist today.
 *
 * Separate from `checklist_runs` because an assignment exists *before* the work
 * does: the whole point is to be able to say "nobody has started the evening
 * list and Johan was supposed to". A run belongs to whoever opened it, which
 * answers a different question — what happened, not what was meant to.
 *
 * Keyed by template rather than by run for the same reason: there is nothing to
 * point at until someone starts.
 */
export const assignments = pgTable(
  'assignments',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    businessDate: date('business_date').notNull(),
    templateCode: text('template_code').notNull(),
    /** 2 is the evening list's "Person 2", matching the signature slots. */
    slot: smallint('slot').notNull().default(1),
    assignedTo: uuid('assigned_to')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    assignedBy: uuid('assigned_by').references(() => users.id),
    assignedAt: timestamp('assigned_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One person per slot per list per day. Re-assigning replaces rather than
    // stacking, so a list cannot quietly end up with two owners.
    uniqueIndex('assignment_unique').on(t.storeId, t.businessDate, t.templateCode, t.slot),
    // "What am I supposed to do today" is the worker's first question.
    index('assignments_by_user_date').on(t.assignedTo, t.businessDate),
  ],
);

export type AssignmentRow = typeof assignments.$inferSelect;
