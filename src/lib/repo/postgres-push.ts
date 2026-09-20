import { eq, inArray } from 'drizzle-orm';
import { getDb, schema } from '@/lib/db/client';
import type { PushRepository } from './types';

export const postgresPushRepository: PushRepository = {
  async savePushSubscription({ userId, endpoint, p256dh, auth, deviceLabel }) {
    const db = getDb();
    // Upsert on endpoint, not on (user, endpoint): a browser handed to another
    // member of staff keeps its endpoint, and the subscription must follow the
    // person who granted it rather than notify the previous one.
    await db
      .insert(schema.pushSubscriptions)
      .values({ userId, endpoint, p256dh, auth, deviceLabel })
      .onConflictDoUpdate({
        target: schema.pushSubscriptions.endpoint,
        set: { userId, p256dh, auth, deviceLabel, lastUsedAt: new Date() },
      });
  },

  async listPushSubscriptions(userIds) {
    if (userIds.length === 0) return [];
    const db = getDb();
    const rows = await db
      .select()
      .from(schema.pushSubscriptions)
      .where(inArray(schema.pushSubscriptions.userId, [...userIds]));

    return rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      endpoint: r.endpoint,
      p256dh: r.p256dh,
      auth: r.auth,
    }));
  },

  async deletePushSubscription(endpoint) {
    const db = getDb();
    await db
      .delete(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.endpoint, endpoint));
  },
};
