import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '@/../db/schema';

/**
 * The one and only database connection in this app.
 *
 * Deliberately **lazy**. Importing this module must never throw or connect:
 * the app is deployed before the database is linked, and a module-level
 * connection would fail the build during static generation.
 *
 * Two further things this avoids:
 *  - a connection per route handler. On Vercel each invocation is its own
 *    process; a pool per route exhausts the Neon pooler under a morning
 *    shift's traffic. ESLint enforces that only this file imports `postgres`.
 *  - re-connecting on every HMR reload in development, which leaks connections
 *    until the pooler refuses new ones. Hence the global cache.
 *
 * `prepare: false` is required: DATABASE_URL points at the Neon pooler, which
 * does not support prepared statements.
 */
function createClient(url: string) {
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
  __gmDb?: ReturnType<typeof drizzle<typeof schema>>;
};

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. The app runs in demo mode without it; this code path requires a database.',
    );
  }
  const existing = globalForDb.__gmSql;
  if (existing) return existing;

  const client = createClient(url);
  globalForDb.__gmSql = client;
  return client;
}

export function getDb() {
  const existing = globalForDb.__gmDb;
  if (existing) return existing;

  const instance = drizzle(getSql(), { schema });
  globalForDb.__gmDb = instance;
  return instance;
}

export type Database = ReturnType<typeof getDb>;
export { schema };
