import {
  bigserial,
  customType,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { stores } from './stores';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

/**
 * Append-only, hash-chained record of everything that changes a checklist.
 *
 * Each row's `rowHash` covers the previous row's hash, so altering or deleting
 * any row in the middle breaks the chain and `scripts/verify-audit-chain.ts`
 * detects it. `UPDATE` and `DELETE` are revoked from the application role in
 * `db/sql/audit_chain.sql`; the trigger there computes the hash.
 *
 * This is what makes a digital checklist more trustworthy than the paper one —
 * a signed run cannot be quietly edited afterwards.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    seq: bigserial('seq', { mode: 'bigint' }).primaryKey(),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    actorUserId: uuid('actor_user_id'),
    /** Frozen copy: the actor's username may change, the record must not. */
    actorUsername: text('actor_username'),
    deviceId: uuid('device_id'),
    /** e.g. 'run_item.answer', 'after_control.set', 'template.publish'. */
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    opId: uuid('op_id'),
    prevHash: bytea('prev_hash'),
    rowHash: bytea('row_hash'),
  },
  (t) => [
    index('audit_entity_idx').on(t.entityType, t.entityId, t.seq),
    index('audit_actor_idx').on(t.actorUserId, t.occurredAt),
  ],
);

export type AuditEntry = typeof auditLog.$inferSelect;
export type NewAuditEntry = typeof auditLog.$inferInsert;
