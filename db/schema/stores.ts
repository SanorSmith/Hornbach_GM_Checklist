import { sql } from 'drizzle-orm';
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * A store's GM department. Everything else is scoped to one of these, so the
 * system can serve a second Hornbach store without a schema change — and so the
 * audit hash chain has a natural partition key.
 */
export const stores = pgTable('stores', {
  id: uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  timezone: text('timezone').notNull().default('Europe/Stockholm'),
  locale: text('locale').notNull().default('sv-SE'),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Store = typeof stores.$inferSelect;
export type NewStore = typeof stores.$inferInsert;
