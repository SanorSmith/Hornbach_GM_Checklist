import { getIronSession, type SessionOptions } from 'iron-session';
import { cookies } from 'next/headers';
import { sessionSecret } from '@/lib/config';
import type { SessionData } from './types';

/** A shift is the natural upper bound; idle logout ends it much sooner. */
export const SESSION_TTL_HOURS = 12;

export function sessionOptions(): SessionOptions {
  return {
    password: sessionSecret(),
    cookieName: 'gm_session',
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_HOURS * 60 * 60,
    },
  };
}

/**
 * The sealed cookie. It is authenticated and encrypted, but it is still only
 * half the check: `sessionId` is looked up in the `sessions` table on every
 * request, so a lost Zebra can be revoked centrally and instantly. A stateless
 * token could not be.
 */
export async function readSession() {
  return getIronSession<Partial<SessionData>>(await cookies(), sessionOptions());
}
