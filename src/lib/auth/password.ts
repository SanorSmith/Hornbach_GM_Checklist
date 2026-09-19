import { hash, verify } from '@node-rs/argon2';

/**
 * argon2id with the OWASP baseline parameters. Used for both passwords and
 * PINs — a 6-digit PIN has very little entropy, so the cost of the hash is
 * doing real work here, together with the lockout in `authenticate()`.
 */
// `Algorithm` is an ambient const enum, which isolatedModules forbids importing,
// so the value is inlined: 0 = Argon2d, 1 = Argon2i, 2 = Argon2id.
const ARGON2ID = 2;

const OPTIONS = {
  algorithm: ARGON2ID,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
} as const;

export async function hashSecret(plain: string): Promise<string> {
  return hash(plain, OPTIONS);
}

export async function verifySecret(digest: string, plain: string): Promise<boolean> {
  try {
    return await verify(digest, plain);
  } catch {
    // A malformed or truncated hash must read as "wrong", never as "throw".
    return false;
  }
}

/**
 * Burns roughly the time a real verification would take.
 *
 * Without this, an unknown username returns noticeably faster than a known one
 * with a wrong PIN, which hands an attacker a list of valid usernames.
 */
export async function dummyVerify(): Promise<void> {
  await verifySecret(DUMMY_HASH, 'not-the-pin');
}

// A fixed argon2id hash of a value nobody can guess, used only for timing.
const DUMMY_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$c29tZS1zdGF0aWMtc2FsdA$JBjK0h1Yd0lPqZ6sJ1wRZ3yqYQOQ9mJq5aXe0kZxXyM';

export const PIN_MIN_LENGTH = 4;
export const PIN_MAX_LENGTH = 8;
export const MAX_PIN_FAILURES = 5;
export const LOCKOUT_MINUTES = 15;

export function isPlausiblePin(pin: string): boolean {
  return (
    pin.length >= PIN_MIN_LENGTH &&
    pin.length <= PIN_MAX_LENGTH &&
    /^[0-9]+$/.test(pin)
  );
}

/** Usernames are stored and compared lower-cased and trimmed. */
export function normaliseUsername(input: string): string {
  return input.trim().toLowerCase();
}
