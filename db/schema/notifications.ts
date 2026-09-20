import { sql } from 'drizzle-orm';
import {
  date,
  index,
  jsonb,
  pgTable,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { notifChannel, notifState } from './enums';
import { users } from './identity';
import { stores } from './stores';

/**
 * Something someone should be told about — today, a list that is late.
 *
 * Rows are created by a scheduled check rather than in reaction to a user
 * action, because the thing worth knowing is an *absence*: nobody started the
 * evening list. Nothing happens to trigger that, which is precisely why it goes
 * unnoticed on paper.
 *
 * `dedupeKey` is what stops the check re-telling the same person the same thing
 * every time it runs. It is a unique index rather than a lookup-then-insert so
 * two overlapping runs cannot both decide they are first.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    businessDate: date('business_date').notNull(),
    templateCode: text('template_code').notNull(),
    slot: smallint('slot').notNull().default(1),
    /** Who should see it: the assignee, or a group leader. */
    recipientId: uuid('recipient_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 'ASSIGNED_NOT_STARTED' | 'NOT_SIGNED_BY_END'. Text so new kinds need no migration. */
    kind: text('kind').notNull(),
    channel: notifChannel('channel').notNull().default('IN_APP'),
    state: notifState('state').notNull().default('SCHEDULED'),
    /** Rendering detail — the list's name, the time it was due. */
    payload: jsonb('payload'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    ackedAt: timestamp('acked_at', { withTimezone: true }),
  },
  (t) => [
    // One telling per person per thing per day.
    uniqueIndex('notification_dedupe').on(
      t.storeId,
      t.businessDate,
      t.templateCode,
      t.slot,
      t.recipientId,
      t.kind,
    ),
    index('notifications_for_recipient').on(t.recipientId, t.state),
  ],
);

export type NotificationRow = typeof notifications.$inferSelect;
