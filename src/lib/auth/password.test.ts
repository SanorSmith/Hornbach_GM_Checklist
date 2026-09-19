import { describe, expect, it } from 'vitest';
import {
  hashSecret,
  isPlausiblePin,
  normaliseUsername,
  verifySecret,
} from './password';
import { isLeader, toPublicUser, type AuthUser } from './types';

describe('secret hashing', () => {
  it('produces an argon2id hash that verifies', async () => {
    const digest = await hashSecret('123456');
    expect(digest.startsWith('$argon2id$')).toBe(true);
    expect(await verifySecret(digest, '123456')).toBe(true);
    expect(await verifySecret(digest, '123457')).toBe(false);
  });

  it('salts, so the same PIN never yields the same hash', async () => {
    expect(await hashSecret('1111')).not.toBe(await hashSecret('1111'));
  });

  it('treats a malformed hash as a failed verification rather than throwing', async () => {
    await expect(verifySecret('not-a-hash', '1111')).resolves.toBe(false);
  });
});

describe('input rules', () => {
  it('accepts PINs of 4 to 8 digits only', () => {
    expect(isPlausiblePin('1234')).toBe(true);
    expect(isPlausiblePin('12345678')).toBe(true);
    expect(isPlausiblePin('123')).toBe(false);
    expect(isPlausiblePin('123456789')).toBe(false);
    expect(isPlausiblePin('12a4')).toBe(false);
    expect(isPlausiblePin('')).toBe(false);
  });

  it('normalises usernames to lower case and trims them', () => {
    expect(normaliseUsername('  Erik.Andersson ')).toBe('erik.andersson');
  });
});

describe('roles', () => {
  const base: AuthUser = {
    id: 'u1',
    storeId: 's1',
    username: 'erik',
    displayName: 'Erik Andersson',
    roles: ['WORKER'],
    isActive: true,
    pinHash: 'x',
    passwordHash: null,
    pinFailedCount: 0,
    lockedUntil: null,
  };

  it('counts an admin as a leader, so after-control is never locked out', () => {
    expect(isLeader(['WORKER'])).toBe(false);
    expect(isLeader(['GROUP_LEADER'])).toBe(true);
    expect(isLeader(['ADMIN'])).toBe(true);
  });

  it('never lets a hash reach the client projection', () => {
    const projected = toPublicUser(base) as unknown as Record<string, unknown>;
    expect(projected.pinHash).toBeUndefined();
    expect(projected.passwordHash).toBeUndefined();
    expect(projected.username).toBe('erik');
  });
});
