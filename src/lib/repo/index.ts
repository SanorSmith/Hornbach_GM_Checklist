import { isDatabaseConfigured } from '@/lib/db/client';
import { createMemoryRepository } from './memory';
import { createPostgresRepository } from './postgres';
import type { Repository } from './types';

const globalForRepo = globalThis as unknown as { __gmRepo?: Repository };

/**
 * Picks the implementation from the environment, once per process.
 *
 * Postgres whenever DATABASE_URL is set; in-memory demo data when it is not.
 * Nothing above this line knows which one it got.
 */
export function repository(): Repository {
  globalForRepo.__gmRepo ??= isDatabaseConfigured()
    ? createPostgresRepository()
    : createMemoryRepository();
  return globalForRepo.__gmRepo;
}

export type { Repository } from './types';
export { DEMO_USERS } from './memory';
