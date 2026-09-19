import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/../db/schema';

/**
 * The one and only database connection in this app.
 *
 * Two things this deliberately avoids:
 *  - a connection per route handler. On Vercel each invocation is its own
 *    process; opening a pool per route exhausts the Supabase pooler under a
 *    morning shift's worth of traffic.
 *  - re-connecting on every HMR reload in development, which leaks connections
 *    until the pooler refuses new ones. Hence the global cache below.
 *
 * `prepare: false` is required: DATABASE_URL points at the Supabase pooler in
 * transaction mode, which does not support prepared statements.
 */
function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.',
    );
  }

  return postgres(url, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
    // Wall-clock deadlines are resolved in Postgres, so the session zone matters.
    connection: { TimeZone: 'Europe/Stockholm' },
  });
}

const globalForDb = globalThis as unknown as {
  __gmSql?: ReturnType<typeof createClient>;
};

export const sql = globalForDb.__gmSql ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForDb.__gmSql = sql;
}

export const db = drizzle(sql, { schema });

export type Database = typeof db;
export { schema };
