import type { AuthUser, Role, SessionRecord } from '@/lib/auth/types';

/**
 * The data access boundary.
 *
 * Two implementations exist: `postgres` whenever DATABASE_URL is set, and
 * `memory` when it is not, so the app is usable before the database is linked.
 * The in-memory one is also the fixture the tests run against, which is why
 * this interface is worth having rather than calling drizzle directly.
 */
export interface Repository {
  readonly mode: 'demo' | 'live';

  findUserByUsername(username: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  listUsers(): Promise<AuthUser[]>;

  /** Returns the new failure count so the caller can decide about lockout. */
  recordPinFailure(userId: string): Promise<number>;
  lockUser(userId: string, until: Date): Promise<void>;
  clearPinFailures(userId: string): Promise<void>;

  createSession(input: {
    userId: string;
    deviceId: string | null;
    expiresAt: Date;
    userAgent?: string | null;
  }): Promise<SessionRecord>;
  findSession(id: string): Promise<SessionRecord | null>;
  touchSession(id: string): Promise<void>;
  revokeSession(id: string): Promise<void>;

  appendAudit(entry: {
    actorUserId: string | null;
    actorUsername: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
  }): Promise<void>;
}

export interface SeedUser {
  username: string;
  displayName: string;
  roles: Role[];
  /** Demo mode only — hashed on first use, never stored in plain text at rest. */
  pin: string;
}
