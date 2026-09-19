import { and, eq, isNull } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import type { AttachmentMeta, EvidenceRepository } from './types';

export const postgresEvidenceRepository: EvidenceRepository = {
  async addAttachment(input) {
    const db = getDb();

    // The unique index on (run_id, item_code, sha256) makes a retry after a
    // dropped connection a no-op rather than a duplicate.
    const [row] = await db
      .insert(schema.attachments)
      .values({
        runId: input.runId,
        itemCode: input.itemCode,
        groupKey: input.groupKey,
        contentType: input.contentType,
        byteSize: input.bytes.byteLength,
        sha256: input.sha256,
        bytes: input.bytes,
        capturedAt: new Date(),
        uploadedBy: input.uploadedBy,
      })
      .onConflictDoNothing()
      .returning();

    if (row) {
      return {
        id: row.id,
        itemCode: row.itemCode,
        groupKey: row.groupKey,
        contentType: row.contentType,
        byteSize: row.byteSize,
        uploadedAt: row.uploadedAt.toISOString(),
      };
    }

    const [existing] = await db
      .select()
      .from(schema.attachments)
      .where(
        and(
          // Scoped to this run: matching on (item_code, sha256) alone would
          // hand back another run's row, and this run would then appear to
          // have no photo for the point at all.
          eq(schema.attachments.runId, input.runId),
          eq(schema.attachments.itemCode, input.itemCode),
          eq(schema.attachments.sha256, input.sha256),
        ),
      )
      .limit(1);
    if (!existing) throw new Error('Kunde inte spara bilden.');

    return {
      id: existing.id,
      itemCode: existing.itemCode,
      groupKey: existing.groupKey,
      contentType: existing.contentType,
      byteSize: existing.byteSize,
      uploadedAt: existing.uploadedAt.toISOString(),
    };
  },

  async listAttachments(runId): Promise<AttachmentMeta[]> {
    const db = getDb();
    const rows = await db
      .select({
        id: schema.attachments.id,
        itemCode: schema.attachments.itemCode,
        groupKey: schema.attachments.groupKey,
        contentType: schema.attachments.contentType,
        byteSize: schema.attachments.byteSize,
        uploadedAt: schema.attachments.uploadedAt,
      })
      .from(schema.attachments)
      .where(
        and(eq(schema.attachments.runId, runId), isNull(schema.attachments.deletedAt)),
      );

    return rows.map((r) => ({ ...r, uploadedAt: r.uploadedAt.toISOString() }));
  },

  async readAttachment(id) {
    const db = getDb();
    const [row] = await db
      .select({
        contentType: schema.attachments.contentType,
        bytes: schema.attachments.bytes,
      })
      .from(schema.attachments)
      .where(and(eq(schema.attachments.id, id), isNull(schema.attachments.deletedAt)))
      .limit(1);

    if (!row?.bytes) return null;
    return { contentType: row.contentType, bytes: row.bytes };
  },

  async deleteAttachment(id) {
    const db = getDb();
    // Soft delete: evidence attached to a signed checklist is part of the
    // record, so it is marked rather than destroyed.
    await db
      .update(schema.attachments)
      .set({ deletedAt: new Date() })
      .where(eq(schema.attachments.id, id));
  },
};
