import { randomUUID } from 'node:crypto';
import type { AuthUser, Role, SessionRecord } from '@/lib/auth/types';
import { hashSecret } from '@/lib/auth/password';
import type { Repository, SeedUser } from './types';

/**
 * In-memory repository, used when DATABASE_URL is unset.
 *
 * This is what makes the site usable before Neon is linked: the whole worker
 * flow runs, but nothing survives a restart and the UI says so. It is also the
 * fixture the route and rules tests run against.
 *
 * State lives at module scope, so on serverless it resets per cold start. That
 * is fine — and honest — for a demo; it is never used when a database exists.
 */

const DEMO_STORE_ID = '00000000-0000-4000-8000-000000000001';

/**
 * Demo credentials. These are printed on the login screen on purpose: a
 * "secret" that is published on a public demo is not a secret, and pretending
 * otherwise is worse than being explicit.
 */
export const DEMO_USERS: readonly SeedUser[] = [
  { username: 'anna', displayName: 'Anna Lindqvist', roles: ['WORKER'], pin: '1111' },
  {
    username: 'erik',
    displayName: 'Erik Andersson',
    roles: ['WORKER', 'GROUP_LEADER'],
    pin: '2222',
  },
  {
    username: 'admin',
    displayName: 'Systemadministratör',
    roles: ['WORKER', 'GROUP_LEADER', 'ADMIN'],
    pin: '3333',
  },
];

interface MemoryState {
  users: Map<string, AuthUser>;
  sessions: Map<string, SessionRecord>;
  audit: unknown[];
}

const globalForMemory = globalThis as unknown as { __gmMemory?: Promise<MemoryState> };

async function buildState(): Promise<MemoryState> {
  const users = new Map<string, AuthUser>();

  // Hashing costs ~165ms each, so do it once per process, lazily.
  await Promise.all(
    DEMO_USERS.map(async (seed, index) => {
      const user: AuthUser = {
        id: `00000000-0000-4000-8000-00000000010${index}`,
        storeId: DEMO_STORE_ID,
        username: seed.username,
        displayName: seed.displayName,
        roles: [...seed.roles] as Role[],
        isActive: true,
        pinHash: await hashSecret(seed.pin),
        passwordHash: null,
        pinFailedCount: 0,
        lockedUntil: null,
      };
      users.set(user.username, user);
    }),
  );

  return { users, sessions: new Map(), audit: [] };
}

function state(): Promise<MemoryState> {
  globalForMemory.__gmMemory ??= buildState();
  return globalForMemory.__gmMemory;
}

export function createMemoryRepository(): Repository {
  return {
    mode: 'demo',

    async findUserByUsername(username) {
      const { users } = await state();
      return users.get(username) ?? null;
    },

    async findUserById(id) {
      const { users } = await state();
      return [...users.values()].find((u) => u.id === id) ?? null;
    },

    async listUsers() {
      const { users } = await state();
      return [...users.values()];
    },

    async recordPinFailure(userId) {
      const { users } = await state();
      const user = [...users.values()].find((u) => u.id === userId);
      if (!user) return 0;
      user.pinFailedCount += 1;
      return user.pinFailedCount;
    },

    async lockUser(userId, until) {
      const { users } = await state();
      const user = [...users.values()].find((u) => u.id === userId);
      if (user) user.lockedUntil = until;
    },

    async clearPinFailures(userId) {
      const { users } = await state();
      const user = [...users.values()].find((u) => u.id === userId);
      if (user) {
        user.pinFailedCount = 0;
        user.lockedUntil = null;
      }
    },

    async createSession({ userId, deviceId, expiresAt }) {
      const { sessions } = await state();
      const record: SessionRecord = {
        id: randomUUID(),
        userId,
        deviceId,
        expiresAt,
        revokedAt: null,
      };
      sessions.set(record.id, record);
      return record;
    },

    async findSession(id) {
      const { sessions } = await state();
      return sessions.get(id) ?? null;
    },

    async touchSession() {
      // Nothing to persist in demo mode.
    },

    async revokeSession(id) {
      const { sessions } = await state();
      const record = sessions.get(id);
      if (record) record.revokedAt = new Date();
    },

    async appendAudit(entry) {
      const { audit } = await state();
      audit.push({ ...entry, occurredAt: new Date() });
    },

    openRun: (...args) => memoryRunRepository.openRun(...args),
    getRun: (...args) => memoryRunRepository.getRun(...args),
    saveAnswer: (...args) => memoryRunRepository.saveAnswer(...args),
    signRun: (...args) => memoryRunRepository.signRun(...args),
    listRunsForDate: (...args) => memoryRunRepository.listRunsForDate(...args),
  };
}

/**
 * Test-only: drops the cached state so each test starts from clean demo users.
 * Re-hashing the PINs costs a few hundred milliseconds, which is the price of
 * not sharing lockout counters between tests.
 */
export function __resetMemoryRepositoryForTests(): void {
  delete (globalThis as { __gmMemory?: unknown }).__gmMemory;
  delete (globalThis as { __gmRepo?: unknown }).__gmRepo;
}

/* -------------------------------------------------------------------------- */
/* Runs (demo mode)                                                           */
/* -------------------------------------------------------------------------- */

import type { AnswerPatch, RunDetail, RunRepository } from './types';

interface RunStore {
  runs: Map<string, RunDetail>;
}

const globalForRuns = globalThis as unknown as { __gmRuns?: RunStore };

function runStore(): RunStore {
  globalForRuns.__gmRuns ??= { runs: new Map() };
  return globalForRuns.__gmRuns;
}

/** Demo runs live in memory and do not survive a restart — the banner says so. */
export const memoryRunRepository: RunRepository = {
  async openRun({ templateCode, templateVersion, businessDate, shift, userId }) {
    const { runs } = runStore();
    const existing = [...runs.values()].find(
      (r) => r.templateCode === templateCode && r.businessDate === businessDate,
    );
    if (existing) return existing;

    const run: RunDetail = {
      id: randomUUID(),
      templateCode,
      templateVersion,
      businessDate,
      shift,
      status: 'OPEN',
      createdBy: userId,
      items: [],
      signatures: [],
    };
    runs.set(run.id, run);
    return run;
  },

  async getRun(runId) {
    return runStore().runs.get(runId) ?? null;
  },

  async saveAnswer(runId, patch: AnswerPatch, userId, answeredAt) {
    const run = runStore().runs.get(runId);
    if (!run) throw new Error(`No such run: ${runId}`);
    if (run.status === 'SUBMITTED') throw new Error('Listan är redan signerad.');

    const existing = run.items.find((i) => i.itemCode === patch.itemCode);
    const merged = {
      itemCode: patch.itemCode,
      answer: patch.answer !== undefined ? patch.answer : existing?.answer,
      answerCode: patch.answerCode !== undefined ? patch.answerCode : existing?.answerCode,
      note: patch.note !== undefined ? patch.note : existing?.note,
      fields: { ...(existing?.fields ?? {}), ...(patch.fields ?? {}) },
      answeredBy: userId,
      answeredAt: answeredAt.toISOString(),
    };

    if (existing) {
      Object.assign(existing, merged);
    } else {
      run.items.push(merged);
    }
  },

  async signRun(runId, input) {
    const run = runStore().runs.get(runId);
    if (!run) throw new Error(`No such run: ${runId}`);
    if (run.signatures.some((s) => s.slot === input.slot)) {
      throw new Error('Listan är redan signerad för den här platsen.');
    }

    run.signatures.push({
      slot: input.slot,
      username: input.username,
      displayName: input.displayName,
      signedAt: new Date().toISOString(),
      signatureHash: input.signatureHash,
    });
    run.status = 'SUBMITTED';
  },

  async listRunsForDate(businessDate) {
    return [...runStore().runs.values()].filter((r) => r.businessDate === businessDate);
  },
};

/** Test-only: forgets every demo run. */
export function __resetRunsForTests(): void {
  delete (globalThis as { __gmRuns?: unknown }).__gmRuns;
}
