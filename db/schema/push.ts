import { sql } from 'drizzle-orm';
import { index, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { users } from './identity';

/**
 * A device that has agreed to receive push notifications.
 *
 * One row per browser per person: the endpoint is issued by the push service
 * (Google, Apple, Mozilla) and is the address the message is delivered to. The
 * two keys encrypt the payload so the push service forwards it without being
 * able to read it.
 *
 * Subscriptions expire on their own — a reinstalled app, a cleared site, a
 * revoked permission — and the push service says so with 404 or 410. Those are
 * deleted rather than retried, or the sweep spends its life pushing into the
 * void.
 */
export const pushSubscriptions = pgTable(
  'push_subscriptions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** Issued by the push service; unique per browser install. */
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    /** For telling "Anna's handheld" from "Anna's phone" when revoking. */
    deviceLabel: text('device_label'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [
    // The endpoint is the identity. Re-subscribing the same browser updates the
    // keys rather than accumulating rows that all reach one device.
    uniqueIndex('push_subscription_endpoint').on(t.endpoint),
    index('push_subscriptions_by_user').on(t.userId),
  ],
);

export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
