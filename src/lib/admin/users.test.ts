import { beforeEach, describe, expect, it } from 'vitest';
import type { Role } from '@/lib/auth/types';
import { __resetMemoryRepositoryForTests } from '@/lib/repo/memory';
import { repository } from '@/lib/repo';
import { listAdminUsers, toAdminUser } from './users';

/**
 * Covers the account administration the seed deliberately does not do: the seed
 * issues one admin and stops, so every other account is created through here.
 */

beforeEach(() => {
  __resetMemoryRepositoryForTests();
});

async function makeUser(username: string, roles: Role[]) {
  return repository().createUser({
    username,
    displayName: username.toUpperCase(),
    roles,
    pinHash: 'argon2id$not-a-real-hash',
  });
}

describe('createUser', () => {
  it('creates an account with exactly the roles asked for', async () => {
    const user = await makeUser('linefeeder1', ['WORKER']);

    expect(user.username).toBe('linefeeder1');
    expect(user.roles).toEqual(['WORKER']);
    expect(user.isActive).toBe(true);
  });

  it('shows up in the administration list', async () => {
    await makeUser('gpl1', ['WORKER', 'GROUP_LEADER']);

    const listed = (await listAdminUsers()).find((u) => u.username === 'gpl1');
    expect(listed?.roles).toEqual(['WORKER', 'GROUP_LEADER']);
  });

  it('refuses a username that already exists', async () => {
    await makeUser('dubbel', ['WORKER']);
    await expect(makeUser('dubbel', ['WORKER'])).rejects.toThrow();
  });

  it('never exposes password material to the admin screen', async () => {
    await makeUser('hemlig', ['WORKER']);

    const listed = (await listAdminUsers()).find((u) => u.username === 'hemlig');
    expect(listed).toBeDefined();
    expect(listed).not.toHaveProperty('pinHash');
    expect(listed).not.toHaveProperty('passwordHash');
  });
});

describe('setUserRoles', () => {
  it('replaces the set rather than adding to it, so a role can be revoked', async () => {
    const user = await makeUser('befordrad', ['WORKER', 'GROUP_LEADER']);

    await repository().setUserRoles(user.id, ['WORKER']);

    const listed = (await listAdminUsers()).find((u) => u.id === user.id);
    expect(listed?.roles).toEqual(['WORKER']);
  });
});

describe('setUserActive', () => {
  it('keeps the account and only blocks sign-in', async () => {
    const user = await makeUser('slutat', ['WORKER']);

    await repository().setUserActive(user.id, false);

    const listed = (await listAdminUsers()).find((u) => u.id === user.id);
    expect(listed).toBeDefined();
    expect(listed?.isActive).toBe(false);
  });
});

describe('setUserPin', () => {
  it('clears an existing lockout, so a reset is also the way out of one', async () => {
    const user = await makeUser('utelast', ['WORKER']);
    await repository().recordPinFailure(user.id);
    await repository().lockUser(user.id, new Date(Date.now() + 60_000));

    expect((await listAdminUsers()).find((u) => u.id === user.id)?.isLocked).toBe(true);

    await repository().setUserPin(user.id, 'argon2id$a-new-hash');

    const after = (await listAdminUsers()).find((u) => u.id === user.id);
    expect(after?.isLocked).toBe(false);
  });
});

describe('toAdminUser', () => {
  const base = {
    id: 'u1',
    storeId: 's1',
    username: 'a',
    displayName: 'A',
    roles: ['WORKER'] as Role[],
    isActive: true,
    pinHash: 'secret',
    passwordHash: null,
    pinFailedCount: 0,
  };

  it('treats an expired lockout as unlocked', () => {
    const past = new Date(1_000);
    expect(toAdminUser({ ...base, lockedUntil: past }, 2_000).isLocked).toBe(false);
  });

  it('treats a lockout still in the future as locked', () => {
    const future = new Date(5_000);
    expect(toAdminUser({ ...base, lockedUntil: future }, 2_000).isLocked).toBe(true);
  });
});
