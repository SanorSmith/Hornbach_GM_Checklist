import { sql } from 'drizzle-orm';
import {
  customType,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { users } from './identity';
import { checklistRuns } from './runs';

const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType: () => 'bytea',
});

/**
 * Photographic evidence — the digital form of "OBS! Alltid skicka bild".
 *
 * The bytes live in Postgres rather than in object storage. At this volume
 * (roughly 15 photos a day, ~250 KB each after compression, so 1-2 GB a year)
 * that is simpler to operate, keeps evidence in the same transaction and the
 * same backup as the answer it belongs to, and needs no second service to be
 * configured before the system works. If volume grows, `storageKey` is the
 * seam: point it at a Neon bucket and stop writing `bytes`.
 *
 * Dedupe on (item, sha256) makes a re-upload after a dropped connection
 * idempotent, which matters on warehouse wifi.
 */
export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    runId: uuid('run_id')
      .notNull()
      .references(() => checklistRuns.id, { onDelete: 'cascade' }),
    /** The template item's stable code. */
    itemCode: text('item_code').notNull(),
    /** Named bucket for points needing several kinds of photo ("golv", "gard"). */
    groupKey: text('group_key'),
    contentType: text('content_type').notNull(),
    byteSize: integer('byte_size').notNull(),
    sha256: text('sha256').notNull(),
    bytes: bytea('bytes'),
    /** Set instead of `bytes` once photos move to object storage. */
    storageKey: text('storage_key'),
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    uploadedAt: timestamp('uploaded_at', { withTimezone: true }).notNull().defaultNow(),
    uploadedBy: uuid('uploaded_by').references(() => users.id),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('attachments_dedupe').on(t.itemCode, t.sha256),
    index('attachments_run_idx').on(t.runId),
  ],
);

export type Attachment = typeof attachments.$inferSelect;
