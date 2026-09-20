import { and, desc, eq } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import { storeId } from './postgres-store';
import type { NotificationRepository } from './types';

export const postgresNotificationRepository: NotificationRepository = {
  async createNotifications(items) {
    if (items.length === 0) return [];
    const db = getDb();
    const store = await storeId();

    // onConflictDoNothing against notification_dedupe: the scheduled check runs
    // repeatedly over the same day, and nobody wants to be told four times that
    // the evening list is late.
    const inserted = await db
      .insert(schema.notifications)
      .values(
        items.map((item) => ({
          storeId: store,
          businessDate: item.businessDate,
          templateCode: item.templateCode,
          slot: item.slot,
          recipientId: item.recipientId,
          kind: item.kind,
          payload: item.payload as object,
        })),
      )
      .onConflictDoNothing()
      .returning({
        templateCode: schema.notifications.templateCode,
        slot: schema.notifications.slot,
        recipientId: schema.notifications.recipientId,
        kind: schema.notifications.kind,
      });

    return inserted;
  },

  async listNotifications(recipientId, businessDate) {
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.notifications)
      .where(
        and(
          eq(schema.notifications.recipientId, recipientId),
          eq(schema.notifications.businessDate, businessDate),
          eq(schema.notifications.state, 'SCHEDULED'),
        ),
      )
      .orderBy(desc(schema.notifications.createdAt));

    return rows.map((r) => ({
      id: r.id,
      templateCode: r.templateCode,
      kind: r.kind,
      state: r.state,
      payload: r.payload as { listName?: string; dueAt?: string; assigneeName?: string | null },
      createdAt: r.createdAt.toISOString(),
    }));
  },

  async ackNotification(id, recipientId) {
    const db = getDb();
    // Scoped to the recipient: acknowledging is saying "I have seen this", and
    // only the person it was shown to can say that.
    await db
      .update(schema.notifications)
      .set({ state: 'ACKED', ackedAt: new Date() })
      .where(
        and(eq(schema.notifications.id, id), eq(schema.notifications.recipientId, recipientId)),
      );
  },
};
