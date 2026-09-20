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

    async createUser({ username, displayName, roles, pinHash }) {
      const { users } = await state();
      if (users.has(username)) throw new Error('Användarnamnet finns redan.');
      const user: AuthUser = {
        id: randomUUID(),
        storeId: DEMO_STORE_ID,
        username,
        displayName,
        roles: [...roles],
        isActive: true,
        pinHash,
        passwordHash: null,
        pinFailedCount: 0,
        lockedUntil: null,
      };
      users.set(username, user);
      return user;
    },

    async setUserRoles(userId, roles) {
      const { users } = await state();
      const user = [...users.values()].find((u) => u.id === userId);
      if (user) user.roles = [...roles];
    },

    async setUserActive(userId, isActive) {
      const { users } = await state();
      const user = [...users.values()].find((u) => u.id === userId);
      if (user) user.isActive = isActive;
    },

    async setUserPin(userId, pinHash) {
      const { users } = await state();
      const user = [...users.values()].find((u) => u.id === userId);
      if (user) {
        user.pinHash = pinHash;
        user.pinFailedCount = 0;
        user.lockedUntil = null;
      }
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
    controlRun: (...args) => memoryRunRepository.controlRun(...args),
    listRunsForDate: (...args) => memoryRunRepository.listRunsForDate(...args),
    listRunsBetween: (...args) => memoryRunRepository.listRunsBetween(...args),

    listAssignments: (...args) => memoryAssignmentRepository.listAssignments(...args),
    setAssignment: (...args) => memoryAssignmentRepository.setAssignment(...args),
    clearAssignment: (...args) => memoryAssignmentRepository.clearAssignment(...args),

    createNotifications: (...args) => memoryNotificationRepository.createNotifications(...args),
    listNotifications: (...args) => memoryNotificationRepository.listNotifications(...args),
    ackNotification: (...args) => memoryNotificationRepository.ackNotification(...args),

    savePushSubscription: (...args) => memoryPushRepository.savePushSubscription(...args),
    listPushSubscriptions: (...args) => memoryPushRepository.listPushSubscriptions(...args),
    deletePushSubscription: (...args) => memoryPushRepository.deletePushSubscription(...args),

    addAttachment: (...args) => memoryEvidenceRepository.addAttachment(...args),
    listAttachments: (...args) => memoryEvidenceRepository.listAttachments(...args),
    readAttachment: (...args) => memoryEvidenceRepository.readAttachment(...args),
    deleteAttachment: (...args) => memoryEvidenceRepository.deleteAttachment(...args),
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
  // Photos live in their own global store, so clearing only the two above left
  // attachments leaking between tests.
  delete (globalThis as { __gmPhotos?: unknown }).__gmPhotos;
  delete (globalThis as { __gmAssignments?: unknown }).__gmAssignments;
  delete (globalThis as { __gmNotifs?: unknown }).__gmNotifs;
  delete (globalThis as { __gmPush?: unknown }).__gmPush;
}

/* -------------------------------------------------------------------------- */
/* Push subscriptions (demo mode)                                             */
/* -------------------------------------------------------------------------- */

interface StoredPushSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

const globalForPush = globalThis as unknown as { __gmPush?: StoredPushSubscription[] };

function pushStore(): StoredPushSubscription[] {
  globalForPush.__gmPush ??= [];
  return globalForPush.__gmPush;
}

export const memoryPushRepository = {
  async savePushSubscription(input: {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    deviceLabel: string | null;
  }) {
    const store = pushStore();
    // Mirrors the unique index on endpoint.
    const existing = store.findIndex((p) => p.endpoint === input.endpoint);
    const record: StoredPushSubscription = {
      id: existing >= 0 ? store[existing]!.id : randomUUID(),
      userId: input.userId,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
    };
    if (existing >= 0) store[existing] = record;
    else store.push(record);
  },

  async listPushSubscriptions(userIds: readonly string[]) {
    const wanted = new Set(userIds);
    return pushStore().filter((p) => wanted.has(p.userId));
  },

  async deletePushSubscription(endpoint: string) {
    const store = pushStore();
    const at = store.findIndex((p) => p.endpoint === endpoint);
    if (at >= 0) store.splice(at, 1);
  },
};

/* -------------------------------------------------------------------------- */
/* Notifications (demo mode)                                                  */
/* -------------------------------------------------------------------------- */

interface StoredNotification {
  id: string;
  businessDate: string;
  templateCode: string;
  slot: number;
  recipientId: string;
  kind: string;
  state: string;
  payload: unknown;
  createdAt: string;
}

const globalForNotifications = globalThis as unknown as { __gmNotifs?: StoredNotification[] };

function notificationStore(): StoredNotification[] {
  globalForNotifications.__gmNotifs ??= [];
  return globalForNotifications.__gmNotifs;
}

export const memoryNotificationRepository = {
  async createNotifications(items: readonly {
    businessDate: string;
    templateCode: string;
    slot: number;
    recipientId: string;
    kind: string;
    payload: unknown;
  }[]) {
    const store = notificationStore();
    const created: { templateCode: string; slot: number; recipientId: string; kind: string }[] = [];
    for (const item of items) {
      // Mirrors the unique index, so the demo mode dedupes exactly as Postgres
      // does and a repeated check does not pile up duplicates.
      const exists = store.some(
        (n) =>
          n.businessDate === item.businessDate &&
          n.templateCode === item.templateCode &&
          n.slot === item.slot &&
          n.recipientId === item.recipientId &&
          n.kind === item.kind,
      );
      if (exists) continue;
      store.push({
        id: randomUUID(),
        ...item,
        state: 'SCHEDULED',
        createdAt: new Date().toISOString(),
      });
      created.push({
        templateCode: item.templateCode,
        slot: item.slot,
        recipientId: item.recipientId,
        kind: item.kind,
      });
    }
    return created;
  },

  async listNotifications(recipientId: string, businessDate: string) {
    return notificationStore()
      .filter(
        (n) =>
          n.recipientId === recipientId &&
          n.businessDate === businessDate &&
          n.state === 'SCHEDULED',
      )
      .map((n) => ({
        id: n.id,
        templateCode: n.templateCode,
        kind: n.kind,
        state: n.state,
        payload: n.payload as { listName?: string; dueAt?: string; assigneeName?: string | null },
        createdAt: n.createdAt,
      }));
  },

  async ackNotification(id: string, recipientId: string) {
    const found = notificationStore().find((n) => n.id === id && n.recipientId === recipientId);
    if (found) found.state = 'ACKED';
  },
};

/* -------------------------------------------------------------------------- */
/* Assignments (demo mode)                                                    */
/* -------------------------------------------------------------------------- */

interface StoredAssignment {
  businessDate: string;
  templateCode: string;
  slot: number;
  assignedTo: string;
  assignedAt: string;
}

const globalForAssignments = globalThis as unknown as { __gmAssignments?: StoredAssignment[] };

function assignmentStore(): StoredAssignment[] {
  globalForAssignments.__gmAssignments ??= [];
  return globalForAssignments.__gmAssignments;
}

/** Keyed the same way as the unique index: one owner per list, day and slot. */
function sameSlot(a: StoredAssignment, b: Omit<StoredAssignment, 'assignedTo' | 'assignedAt'>) {
  return (
    a.businessDate === b.businessDate && a.templateCode === b.templateCode && a.slot === b.slot
  );
}

export const memoryAssignmentRepository = {
  async listAssignments(businessDate: string) {
    const users = (await state()).users;
    const byId = new Map([...users.values()].map((u) => [u.id, u.displayName]));
    return assignmentStore()
      .filter((a) => a.businessDate === businessDate)
      .map((a) => ({
        templateCode: a.templateCode,
        slot: a.slot,
        assignedTo: a.assignedTo,
        assignedToName: byId.get(a.assignedTo) ?? 'Okänd',
        assignedAt: a.assignedAt,
      }));
  },

  async setAssignment(input: {
    businessDate: string;
    templateCode: string;
    slot: number;
    assignedTo: string;
    assignedBy: string;
  }) {
    const store = assignmentStore();
    const existing = store.findIndex((a) => sameSlot(a, input));
    const record: StoredAssignment = {
      businessDate: input.businessDate,
      templateCode: input.templateCode,
      slot: input.slot,
      assignedTo: input.assignedTo,
      assignedAt: new Date().toISOString(),
    };
    if (existing >= 0) store[existing] = record;
    else store.push(record);
  },

  async clearAssignment(input: { businessDate: string; templateCode: string; slot: number }) {
    const store = assignmentStore();
    const at = store.findIndex((a) => sameSlot(a, input));
    if (at >= 0) store.splice(at, 1);
  },
};

/** Test-only: forgets every assignment. */
export function __resetAssignmentsForTests(): void {
  delete (globalThis as { __gmAssignments?: unknown }).__gmAssignments;
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
      control: { status: 'PENDING', by: null, at: null, note: null },
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
    // Mirrors the unique index on (run, slot, purpose). Keyed on slot alone,
    // a leader's control signature would collide with the worker's.
    if (run.signatures.some((s) => s.slot === input.slot && s.purpose === 'WORKER_SUBMIT')) {
      throw new Error('Listan är redan signerad för den här platsen.');
    }

    run.signatures.push({
      slot: input.slot,
      purpose: 'WORKER_SUBMIT',
      username: input.username,
      displayName: input.displayName,
      signedAt: new Date().toISOString(),
      signatureHash: input.signatureHash,
    });
    run.status = 'SUBMITTED';
  },

  async controlRun(runId, input) {
    const run = runStore().runs.get(runId);
    if (!run) throw new Error(`No such run: ${runId}`);
    if (run.status !== 'SUBMITTED') {
      throw new Error('Listan är inte inlämnad än.');
    }
    if (run.signatures.some((s) => s.purpose === 'LEADER_CONTROL')) {
      throw new Error('Listan är redan efterkontrollerad.');
    }

    const at = new Date().toISOString();
    run.signatures.push({
      slot: 1,
      purpose: 'LEADER_CONTROL',
      username: input.username,
      displayName: input.displayName,
      signedAt: at,
      signatureHash: input.signatureHash,
    });
    run.control = { status: input.status, by: input.displayName, at, note: input.note };
  },

  async listRunsBetween(from: string, to: string) {
    const { users } = await state();
    const nameById = new Map([...users.values()].map((u) => [u.id, u.displayName]));

    return [...runStore().runs.values()]
      .filter((r) => r.businessDate >= from && r.businessDate <= to)
      .sort((a, b) => b.businessDate.localeCompare(a.businessDate))
      .map((r) => ({
        id: r.id,
        templateCode: r.templateCode,
        businessDate: r.businessDate,
        status: r.status,
        performedByName: r.createdBy ? (nameById.get(r.createdBy) ?? null) : null,
        submittedAt: r.signatures.find((sig) => sig.purpose === 'WORKER_SUBMIT')?.signedAt ?? null,
        controlStatus: r.control.status,
        controlledByName: r.control.by,
        controlledAt: r.control.at,
        controlNote: r.control.note,
      }));
  },

  async listRunsForDate(businessDate) {
    return [...runStore().runs.values()].filter((r) => r.businessDate === businessDate);
  },
};

/** Test-only: forgets every demo run. */
export function __resetRunsForTests(): void {
  delete (globalThis as { __gmRuns?: unknown }).__gmRuns;
}

/* -------------------------------------------------------------------------- */
/* Evidence (demo mode)                                                       */
/* -------------------------------------------------------------------------- */

import type { AttachmentMeta, EvidenceRepository } from './types';

interface StoredAttachment extends AttachmentMeta {
  runId: string;
  sha256: string;
  bytes: Buffer;
}

const globalForPhotos = globalThis as unknown as {
  __gmPhotos?: Map<string, StoredAttachment>;
};

function photoStore(): Map<string, StoredAttachment> {
  globalForPhotos.__gmPhotos ??= new Map();
  return globalForPhotos.__gmPhotos;
}

export const memoryEvidenceRepository: EvidenceRepository = {
  async addAttachment(input) {
    const store = photoStore();

    // Re-uploading the same photo after a dropped connection must not create a
    // duplicate — warehouse wifi makes that a routine event, not an edge case.
    //
    // Matched on runId too, so this behaves like the attachments_dedupe index:
    // without it, a byte-identical photo from an earlier run would be returned
    // here and this run would show no photo for the point.
    const existing = [...store.values()].find(
      (a) =>
        a.runId === input.runId &&
        a.itemCode === input.itemCode &&
        a.sha256 === input.sha256,
    );
    if (existing) return existing;

    const record: StoredAttachment = {
      id: randomUUID(),
      runId: input.runId,
      itemCode: input.itemCode,
      groupKey: input.groupKey,
      contentType: input.contentType,
      byteSize: input.bytes.byteLength,
      sha256: input.sha256,
      bytes: input.bytes,
      uploadedAt: new Date().toISOString(),
    };
    store.set(record.id, record);
    return record;
  },

  async listAttachments(runId) {
    return [...photoStore().values()]
      .filter((a) => a.runId === runId)
      .map(({ bytes: _bytes, sha256: _sha, runId: _run, ...meta }) => meta);
  },

  async readAttachment(id) {
    const found = photoStore().get(id);
    return found ? { contentType: found.contentType, bytes: found.bytes } : null;
  },

  async deleteAttachment(id) {
    photoStore().delete(id);
  },
};
