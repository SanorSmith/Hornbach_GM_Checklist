import { beforeEach, describe, expect, it } from 'vitest';
import { repository } from '@/lib/repo';
import { DEMO_USERS, __resetMemoryRepositoryForTests } from './memory';

beforeEach(() => {
  __resetMemoryRepositoryForTests();
});

describe('the demo repository', () => {
  it('returns users in seed order, not in whatever order the hashes finished', async () => {
    // Each user's PIN is hashed in parallel. Inserting from inside those
    // callbacks made the order depend on which hash won the race, so the
    // group leader's dropdown reshuffled between restarts.
    for (let attempt = 0; attempt < 3; attempt++) {
      __resetMemoryRepositoryForTests();
      const users = await repository().listUsers();
      expect(users.map((u) => u.username)).toEqual(DEMO_USERS.map((u) => u.username));
    }
  });

  it('gives every demo user a distinct, stable id', async () => {
    const first = await repository().listUsers();
    __resetMemoryRepositoryForTests();
    const second = await repository().listUsers();

    const ids = first.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(second.map((u) => u.id)).toEqual(ids);
  });
});
