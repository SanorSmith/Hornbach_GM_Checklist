import { repository } from '@/lib/repo';
import {
  LOCKOUT_MINUTES,
  MAX_PIN_FAILURES,
  dummyVerify,
  isPlausiblePin,
  normaliseUsername,
  verifySecret,
} from './password';
import type { AuthUser } from './types';

export type AuthFailure =
  | { ok: false; reason: 'INVALID_INPUT' }
  | { ok: false; reason: 'BAD_CREDENTIALS' }
  | { ok: false; reason: 'LOCKED'; until: Date }
  | { ok: false; reason: 'INACTIVE' };

export type AuthResult = { ok: true; user: AuthUser } | AuthFailure;

/**
 * Username + PIN sign-in for shared handhelds.
 *
 * Three things this is careful about:
 *  - **Timing.** An unknown username still burns an argon2 verification, so
 *    response time does not reveal which usernames exist.
 *  - **Lockout.** A 4-6 digit PIN is guessable by hand; after five failures the
 *    account is locked for fifteen minutes. Without this the PIN is decorative.
 *  - **Message.** Every failure that is not a lockout returns the same reason,
 *    so the response never distinguishes "no such user" from "wrong PIN".
 */
export async function authenticate(
  rawUsername: string,
  pin: string,
  now: Date = new Date(),
): Promise<AuthResult> {
  const username = normaliseUsername(rawUsername);

  if (username.length === 0 || !isPlausiblePin(pin)) {
    await dummyVerify();
    return { ok: false, reason: 'INVALID_INPUT' };
  }

  const repo = repository();
  const user = await repo.findUserByUsername(username);

  if (!user) {
    await dummyVerify();
    return { ok: false, reason: 'BAD_CREDENTIALS' };
  }

  if (!user.isActive) {
    await dummyVerify();
    return { ok: false, reason: 'INACTIVE' };
  }

  if (user.lockedUntil && user.lockedUntil > now) {
    await dummyVerify();
    return { ok: false, reason: 'LOCKED', until: user.lockedUntil };
  }

  if (!user.pinHash) {
    await dummyVerify();
    return { ok: false, reason: 'BAD_CREDENTIALS' };
  }

  const valid = await verifySecret(user.pinHash, pin);

  if (!valid) {
    const failures = await repo.recordPinFailure(user.id);
    if (failures >= MAX_PIN_FAILURES) {
      const until = new Date(now.getTime() + LOCKOUT_MINUTES * 60_000);
      await repo.lockUser(user.id, until);
      await repo.appendAudit({
        actorUserId: user.id,
        actorUsername: user.username,
        action: 'auth.locked',
        entityType: 'user',
        entityId: user.id,
        after: { failures, until: until.toISOString() },
      });
      return { ok: false, reason: 'LOCKED', until };
    }
    return { ok: false, reason: 'BAD_CREDENTIALS' };
  }

  if (user.pinFailedCount > 0 || user.lockedUntil) {
    await repo.clearPinFailures(user.id);
  }

  return { ok: true, user };
}
