export const ROLES = ['WORKER', 'GROUP_LEADER', 'ADMIN'] as const;
export type Role = (typeof ROLES)[number];

/** A user as authentication needs them. Never send `*Hash` to the client. */
export interface AuthUser {
  id: string;
  storeId: string;
  username: string;
  displayName: string;
  roles: Role[];
  isActive: boolean;
  pinHash: string | null;
  passwordHash: string | null;
  pinFailedCount: number;
  lockedUntil: Date | null;
}

/** The safe projection that may cross to the browser. */
export interface PublicUser {
  id: string;
  username: string;
  displayName: string;
  roles: Role[];
}

export function toPublicUser(user: AuthUser): PublicUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    roles: user.roles,
  };
}

export interface SessionRecord {
  id: string;
  userId: string;
  deviceId: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
}

/**
 * What the sealed cookie carries. Deliberately small: the authoritative check
 * is always the `sessions` row, so a stolen cookie can be revoked.
 */
export interface SessionData {
  sessionId: string;
  userId: string;
  storeId: string;
  roles: Role[];
  username: string;
  displayName: string;
  /** Shared devices get a much shorter idle timeout. */
  deviceShared: boolean;
}

export function hasRole(roles: readonly Role[], required: Role): boolean {
  return roles.includes(required);
}

export function isLeader(roles: readonly Role[]): boolean {
  return hasRole(roles, 'GROUP_LEADER') || hasRole(roles, 'ADMIN');
}
