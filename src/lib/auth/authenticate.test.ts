import { beforeEach, describe, expect, it } from 'vitest';
import { authenticate } from './authenticate';
import { MAX_PIN_FAILURES } from './password';
import { __resetMemoryRepositoryForTests } from '@/lib/repo/memory';

// No DATABASE_URL in tests, so the in-memory repository with the demo users is
// what `authenticate` talks to.
beforeEach(() => {
  __resetMemoryRepositoryForTests();
});

describe('authenticate', () => {
  it('accepts a correct username and PIN', async () => {
    const result = await authenticate('anna', '1111');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.user.username).toBe('anna');
      expect(result.user.roles).toContain('WORKER');
    }
  });

  it('is case-insensitive about the username', async () => {
    const result = await authenticate('  ANNA  ', '1111');
    expect(result.ok).toBe(true);
  });

  it('rejects a wrong PIN', async () => {
    const result = await authenticate('anna', '9999');
    expect(result).toEqual({ ok: false, reason: 'BAD_CREDENTIALS' });
  });

  it('gives an unknown user the same answer as a wrong PIN', async () => {
    // Anything more specific hands out a list of valid usernames.
    const unknown = await authenticate('ingen-finns', '1111');
    const wrongPin = await authenticate('anna', '9999');
    expect(unknown).toEqual(wrongPin);
  });

  it('rejects a PIN that is too short or not numeric before touching the store', async () => {
    expect(await authenticate('anna', '11')).toEqual({ ok: false, reason: 'INVALID_INPUT' });
    expect(await authenticate('anna', 'abcd')).toEqual({ ok: false, reason: 'INVALID_INPUT' });
  });

  it('locks the account after five failures', async () => {
    for (let attempt = 1; attempt < MAX_PIN_FAILURES; attempt += 1) {
      const result = await authenticate('anna', '0000');
      expect(result).toEqual({ ok: false, reason: 'BAD_CREDENTIALS' });
    }

    const locked = await authenticate('anna', '0000');
    expect(locked.ok).toBe(false);
    if (!locked.ok && locked.reason === 'LOCKED') {
      expect(locked.until.getTime()).toBeGreaterThan(Date.now());
    } else {
      expect.unreachable('expected a LOCKED result');
    }
  });

  it('refuses the correct PIN while the account is locked', async () => {
    for (let attempt = 0; attempt < MAX_PIN_FAILURES; attempt += 1) {
      await authenticate('anna', '0000');
    }
    const result = await authenticate('anna', '1111');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('LOCKED');
  });

  it('clears the failure count after a successful sign-in', async () => {
    await authenticate('anna', '0000');
    await authenticate('anna', '0000');
    expect((await authenticate('anna', '1111')).ok).toBe(true);

    // Four more failures must not lock, because the counter was reset.
    for (let attempt = 0; attempt < MAX_PIN_FAILURES - 1; attempt += 1) {
      const result = await authenticate('anna', '0000');
      expect(result).toEqual({ ok: false, reason: 'BAD_CREDENTIALS' });
    }
  });

  it('honours an explicit lock that has already expired', async () => {
    for (let attempt = 0; attempt < MAX_PIN_FAILURES; attempt += 1) {
      await authenticate('anna', '0000');
    }
    // Sixteen minutes later the lock has lapsed.
    const later = new Date(Date.now() + 16 * 60_000);
    const result = await authenticate('anna', '1111', later);
    expect(result.ok).toBe(true);
  });
});
