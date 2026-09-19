import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  inet,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { shiftCode, userRole } from './enums';
import { stores } from './stores';

/**
 * A person. `username` is the identity that appears on a signature — the paper
 * form's "Genomförs av" becomes display name plus username, so both are frozen
 * into the signature record at signing time.
 *
 * Usernames are stored already lower-cased (see `normaliseUsername`) with a
 * unique index per store. That avoids depending on the `citext` extension.
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    username: text('username').notNull(),
    displayName: text('display_name').notNull(),
    employeeNo: text('employee_no'),
    email: text('email'),
    /** argon2id. Null for staff who only ever sign in with a PIN. */
    passwordHash: text('password_hash'),
    /** argon2id over the PIN. Never stored or compared in plain text. */
    pinHash: text('pin_hash'),
    pinFailedCount: smallint('pin_failed_count').notNull().default(0),
    lockedUntil: timestamp('locked_until', { withTimezone: true }),
    isActive: boolean('is_active').notNull().default(true),
    defaultShift: shiftCode('default_shift'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_store_username_uq').on(t.storeId, t.username)],
);

/**
 * Roles are grants, not a column: a gruppledare holds both WORKER (they run the
 * GPL checklist themselves) and GROUP_LEADER (they after-control other people's).
 */
export const userRoleGrants = pgTable(
  'user_role_grants',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: userRole('role').notNull(),
    grantedBy: uuid('granted_by'),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.role] })],
);

/**
 * Badge sign-in, modelled now and used later. Zebra DataWedge can deliver a
 * scan as keystrokes into the browser, so "scan badge, then PIN" works without
 * any app install. Only a peppered hash of the barcode is stored, never the
 * number itself.
 */
export const badgeCredentials = pgTable(
  'badge_credentials',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    badgeHash: text('badge_hash').notNull(),
    label: text('label'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('badge_hash_active_uq').on(t.badgeHash)],
);

/**
 * A physical device. `isShared` is what drives the short idle timeout: a Zebra
 * passed between shifts must not stay signed in as whoever used it last.
 */
export const devices = pgTable(
  'devices',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    storeId: uuid('store_id')
      .notNull()
      .references(() => stores.id),
    deviceKey: text('device_key').notNull().unique(),
    label: text('label'),
    kind: text('kind').notNull().default('ZEBRA'),
    isShared: boolean('is_shared').notNull().default(true),
    appVersion: text('app_version'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
);

/**
 * Sessions are rows, not just a signed cookie. A stateless token cannot be
 * revoked, and a Zebra scanner does occasionally walk out of the building.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id')
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    deviceId: uuid('device_id').references(() => devices.id),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    ip: inet('ip'),
    userAgent: text('user_agent'),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Device = typeof devices.$inferSelect;
