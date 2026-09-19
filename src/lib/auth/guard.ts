import { redirect } from 'next/navigation';
import { repository } from '@/lib/repo';
import { readSession } from './session';
import { isLeader, type Role, type SessionData } from './types';

export class AuthError extends Error {
  constructor(
    readonly status: 401 | 403,
    message: string,
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

/**
 * Resolves the current user, or null.
 *
 * The sealed cookie is necessary but not sufficient: the `sessions` row is
 * checked every time, so revoking a session takes effect on the next request
 * rather than whenever the cookie happens to expire.
 */
export async function currentSession(): Promise<SessionData | null> {
  const session = await readSession();
  if (!session.sessionId || !session.userId) return null;

  const repo = repository();
  const record = await repo.findSession(session.sessionId);
  if (!record) return null;
  if (record.revokedAt) return null;
  if (record.expiresAt.getTime() <= Date.now()) return null;
  if (record.userId !== session.userId) return null;

  return session as SessionData;
}

/**
 * For API route handlers. Throws, and the route turns it into a status code.
 *
 * Every route calls this for itself. `src/proxy.ts` guards *pages* only —
 * treating `/api` as covered there is how APIs end up unauthenticated.
 */
export async function requireUser(): Promise<SessionData> {
  const session = await currentSession();
  if (!session) throw new AuthError(401, 'Inte inloggad.');
  return session;
}

export async function requireRole(role: Role): Promise<SessionData> {
  const session = await requireUser();
  const allowed = role === 'GROUP_LEADER' ? isLeader(session.roles) : session.roles.includes(role);
  if (!allowed) throw new AuthError(403, 'Saknar behörighet.');
  return session;
}

/** For server components: send the visitor to the login screen instead. */
export async function requireUserOrRedirect(returnTo?: string): Promise<SessionData> {
  const session = await currentSession();
  if (!session) {
    const target = returnTo ? `/login?returnTo=${encodeURIComponent(returnTo)}` : '/login';
    redirect(target);
  }
  return session;
}

export async function requireLeaderOrRedirect(): Promise<SessionData> {
  const session = await requireUserOrRedirect('/gpl');
  if (!isLeader(session.roles)) redirect('/');
  return session;
}
