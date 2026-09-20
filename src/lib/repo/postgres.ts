import { and, eq, sql as raw } from 'drizzle-orm';
import type { AuthUser, Role } from '@/lib/auth/types';
import { getDb, schema } from '@/lib/db/client';
import { postgresAssignmentRepository } from './postgres-assignments';
import { postgresEvidenceRepository } from './postgres-evidence';
import { postgresNotificationRepository } from './postgres-notifications';
import { postgresPushRepository } from './postgres-push';
import { postgresRunRepository } from './postgres-runs';
import { storeId } from './postgres-store';
import type { Repository } from './types';

async function loadUser(where: ReturnType<typeof eq>): Promise<AuthUser | null> {
  const db = getDb();
  const [row] = await db.select().from(schema.users).where(where).limit(1);
  if (!row) return null;

  const grants = await db
    .select({ role: schema.userRoleGrants.role })
    .from(schema.userRoleGrants)
    .where(eq(schema.userRoleGrants.userId, row.id));

  return {
    id: row.id,
    storeId: row.storeId,
    username: row.username,
    displayName: row.displayName,
    roles: grants.map((g) => g.role as Role),
    isActive: row.isActive,
    pinHash: row.pinHash,
    passwordHash: row.passwordHash,
    pinFailedCount: row.pinFailedCount,
    lockedUntil: row.lockedUntil,
  };
}

export function createPostgresRepository(): Repository {
  return {
    mode: 'live',

    async findUserByUsername(username) {
      const store = await storeId();
      return loadUser(
        and(eq(schema.users.storeId, store), eq(schema.users.username, username))!,
      );
    },

    async findUserById(id) {
      return loadUser(eq(schema.users.id, id));
    },

    async listUsers() {
      const db = getDb();
      const store = await storeId();
      const rows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.storeId, store));

      const grants = await db.select().from(schema.userRoleGrants);
      return rows.map((row) => ({
        id: row.id,
        storeId: row.storeId,
        username: row.username,
        displayName: row.displayName,
        roles: grants.filter((g) => g.userId === row.id).map((g) => g.role as Role),
        isActive: row.isActive,
        pinHash: row.pinHash,
        passwordHash: row.passwordHash,
        pinFailedCount: row.pinFailedCount,
        lockedUntil: row.lockedUntil,
      }));
    },

    async createUser({ username, displayName, roles, pinHash }) {
      const db = getDb();
      const store = await storeId();
      const [row] = await db
        .insert(schema.users)
        .values({ storeId: store, username, displayName, pinHash })
        .returning();
      if (!row) throw new Error('Kunde inte skapa användaren.');

      if (roles.length > 0) {
        await db
          .insert(schema.userRoleGrants)
          .values(roles.map((role) => ({ userId: row.id, role })));
      }

      return {
        id: row.id,
        storeId: row.storeId,
        username: row.username,
        displayName: row.displayName,
        roles: [...roles],
        isActive: row.isActive,
        pinHash: row.pinHash,
        passwordHash: row.passwordHash,
        pinFailedCount: row.pinFailedCount,
        lockedUntil: row.lockedUntil,
      };
    },

    async setUserRoles(userId, roles) {
      const db = getDb();
      // Replaced wholesale rather than diffed: the admin screen always sends the
      // complete set, and a partial update is how a revoked role survives.
      await db.delete(schema.userRoleGrants).where(eq(schema.userRoleGrants.userId, userId));
      if (roles.length > 0) {
        await db.insert(schema.userRoleGrants).values(roles.map((role) => ({ userId, role })));
      }
    },

    async setUserActive(userId, isActive) {
      const db = getDb();
      // Deactivate rather than delete: the signatures this person already made
      // are part of the record and still have to resolve to a name.
      await db
        .update(schema.users)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));
    },

    async setUserPin(userId, pinHash) {
      const db = getDb();
      await db
        .update(schema.users)
        .set({ pinHash, pinFailedCount: 0, lockedUntil: null, updatedAt: new Date() })
        .where(eq(schema.users.id, userId));
    },

    async recordPinFailure(userId) {
      const db = getDb();
      const [row] = await db
        .update(schema.users)
        .set({ pinFailedCount: raw`${schema.users.pinFailedCount} + 1` })
        .where(eq(schema.users.id, userId))
        .returning({ count: schema.users.pinFailedCount });
      return row?.count ?? 0;
    },

    async lockUser(userId, until) {
      const db = getDb();
      await db
        .update(schema.users)
        .set({ lockedUntil: until })
        .where(eq(schema.users.id, userId));
    },

    async clearPinFailures(userId) {
      const db = getDb();
      await db
        .update(schema.users)
        .set({ pinFailedCount: 0, lockedUntil: null })
        .where(eq(schema.users.id, userId));
    },

    async createSession({ userId, deviceId, expiresAt, userAgent }) {
      const db = getDb();
      const [row] = await db
        .insert(schema.sessions)
        .values({ userId, deviceId, expiresAt, userAgent: userAgent ?? null })
        .returning();
      if (!row) throw new Error('Failed to create session.');
      return {
        id: row.id,
        userId: row.userId,
        deviceId: row.deviceId,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
      };
    },

    async findSession(id) {
      const db = getDb();
      const [row] = await db
        .select()
        .from(schema.sessions)
        .where(eq(schema.sessions.id, id))
        .limit(1);
      if (!row) return null;
      return {
        id: row.id,
        userId: row.userId,
        deviceId: row.deviceId,
        expiresAt: row.expiresAt,
        revokedAt: row.revokedAt,
      };
    },

    async touchSession(id) {
      const db = getDb();
      await db
        .update(schema.sessions)
        .set({ lastSeenAt: new Date() })
        .where(eq(schema.sessions.id, id));
    },

    async revokeSession(id) {
      const db = getDb();
      await db
        .update(schema.sessions)
        .set({ revokedAt: new Date() })
        .where(eq(schema.sessions.id, id));
    },

    async appendAudit(entry) {
      const db = getDb();
      const store = await storeId();
      // prev_hash / row_hash are filled by the BEFORE INSERT trigger in
      // db/migrations/0004_audit_chain.sql — never computed here, so a buggy
      // client cannot forge a chain link.
      await db.insert(schema.auditLog).values({
        storeId: store,
        actorUserId: entry.actorUserId,
        actorUsername: entry.actorUsername,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        before: entry.before ?? null,
        after: entry.after ?? null,
      });
    },

    openRun: (...args) => postgresRunRepository.openRun(...args),
    getRun: (...args) => postgresRunRepository.getRun(...args),
    saveAnswer: (...args) => postgresRunRepository.saveAnswer(...args),
    signRun: (...args) => postgresRunRepository.signRun(...args),
    controlRun: (...args) => postgresRunRepository.controlRun(...args),
    listRunsForDate: (...args) => postgresRunRepository.listRunsForDate(...args),

    listAssignments: (...args) => postgresAssignmentRepository.listAssignments(...args),
    setAssignment: (...args) => postgresAssignmentRepository.setAssignment(...args),
    clearAssignment: (...args) => postgresAssignmentRepository.clearAssignment(...args),

    createNotifications: (...args) => postgresNotificationRepository.createNotifications(...args),
    listNotifications: (...args) => postgresNotificationRepository.listNotifications(...args),
    ackNotification: (...args) => postgresNotificationRepository.ackNotification(...args),

    savePushSubscription: (...args) => postgresPushRepository.savePushSubscription(...args),
    listPushSubscriptions: (...args) => postgresPushRepository.listPushSubscriptions(...args),
    deletePushSubscription: (...args) => postgresPushRepository.deletePushSubscription(...args),

    addAttachment: (...args) => postgresEvidenceRepository.addAttachment(...args),
    listAttachments: (...args) => postgresEvidenceRepository.listAttachments(...args),
    readAttachment: (...args) => postgresEvidenceRepository.readAttachment(...args),
    deleteAttachment: (...args) => postgresEvidenceRepository.deleteAttachment(...args),
  };
}
