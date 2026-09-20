import type { AuthUser, Role } from '@/lib/auth/types';
import { repository } from '@/lib/repo';

/**
 * A staff account as the administration screen sees it.
 *
 * Deliberately without `pinHash` or `passwordHash`: the admin screen has no
 * business receiving password material, and a shape that cannot carry it cannot
 * leak it.
 */
export interface AdminUser {
  id: string;
  username: string;
  displayName: string;
  roles: Role[];
  isActive: boolean;
  isLocked: boolean;
}

export function toAdminUser(user: AuthUser, now: number): AdminUser {
  return {
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    roles: user.roles,
    isActive: user.isActive,
    isLocked: Boolean(user.lockedUntil && user.lockedUntil.getTime() > now),
  };
}

/**
 * Loads every account for the store, ready to render.
 *
 * Lives here rather than in the page because working out whether a lockout is
 * still in force means reading the clock, and reading the clock while rendering
 * makes the output depend on when the render happened to run.
 */
export async function listAdminUsers(): Promise<AdminUser[]> {
  const rows = await repository().listUsers();
  const now = Date.now();
  return rows
    .map((user) => toAdminUser(user, now))
    .sort((a, b) => a.username.localeCompare(b.username, 'sv'));
}
