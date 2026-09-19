import { eq } from 'drizzle-orm';
import { STORE_CODE } from '@/lib/config';
import { getDb, schema } from '@/lib/db/client';

const globalForStore = globalThis as unknown as { __gmStoreId?: Promise<string> };

/** Resolved once per process — the store row does not change during a deploy. */
export function storeId(): Promise<string> {
  globalForStore.__gmStoreId ??= (async () => {
    const db = getDb();
    const [row] = await db
      .select({ id: schema.stores.id })
      .from(schema.stores)
      .where(eq(schema.stores.code, STORE_CODE))
      .limit(1);
    if (!row) {
      throw new Error(
        `No store with code "${STORE_CODE}". Run \`npm run seed\` after applying migrations.`,
      );
    }
    return row.id;
  })();
  return globalForStore.__gmStoreId;
}
