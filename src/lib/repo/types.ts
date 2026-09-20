import type { AuthUser, Role, SessionRecord } from '@/lib/auth/types';

/**
 * The data access boundary.
 *
 * Two implementations exist: `postgres` whenever DATABASE_URL is set, and
 * `memory` when it is not, so the app is usable before the database is linked.
 * The in-memory one is also the fixture the tests run against, which is why
 * this interface is worth having rather than calling drizzle directly.
 */
export interface Repository extends RunRepository, EvidenceRepository {
  readonly mode: 'demo' | 'live';

  findUserByUsername(username: string): Promise<AuthUser | null>;
  findUserById(id: string): Promise<AuthUser | null>;
  listUsers(): Promise<AuthUser[]>;

  /**
   * Creates a staff account. The PIN arrives already hashed — plain PINs never
   * reach the repository, so they cannot be logged or stored by accident.
   */
  createUser(input: {
    username: string;
    displayName: string;
    roles: Role[];
    pinHash: string;
  }): Promise<AuthUser>;

  /** Replaces the user's role grants with exactly this set. */
  setUserRoles(userId: string, roles: Role[]): Promise<void>;

  /** Deactivating keeps the account and its signatures; it only blocks sign-in. */
  setUserActive(userId: string, isActive: boolean): Promise<void>;

  /** Issues a new PIN and clears any lockout from the old one. */
  setUserPin(userId: string, pinHash: string): Promise<void>;

  /** Returns the new failure count so the caller can decide about lockout. */
  recordPinFailure(userId: string): Promise<number>;
  lockUser(userId: string, until: Date): Promise<void>;
  clearPinFailures(userId: string): Promise<void>;

  createSession(input: {
    userId: string;
    deviceId: string | null;
    expiresAt: Date;
    userAgent?: string | null;
  }): Promise<SessionRecord>;
  findSession(id: string): Promise<SessionRecord | null>;
  touchSession(id: string): Promise<void>;
  revokeSession(id: string): Promise<void>;

  appendAudit(entry: {
    actorUserId: string | null;
    actorUsername: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
  }): Promise<void>;
}

export interface SeedUser {
  username: string;
  displayName: string;
  roles: Role[];
  /** Demo mode only — hashed on first use, never stored in plain text at rest. */
  pin: string;
}

/* -------------------------------------------------------------------------- */
/* Runs                                                                       */
/* -------------------------------------------------------------------------- */

export type ShiftCode = 'MORNING' | 'MIDDAY' | 'EVENING' | 'FULL_DAY';

export interface RunSignature {
  slot: number;
  /** 'WORKER_SUBMIT' for the person who did the list, 'LEADER_CONTROL' for the review. */
  purpose: string;
  username: string;
  displayName: string;
  signedAt: string;
  signatureHash: string;
}

export interface RunDetail {
  id: string;
  templateCode: string;
  /** Pinned: the run is forever evaluated against the version it was performed on. */
  templateVersion: number;
  businessDate: string;
  shift: ShiftCode;
  status: 'OPEN' | 'SUBMITTED';
  createdBy: string | null;
  items: RunItemStateRecord[];
  signatures: RunSignature[];
  control: RunControl;
}

export type ControlStatus = 'PENDING' | 'OK' | 'NOT_OK' | 'FOLLOW_UP';

/** Efterkontroll: the group leader's verdict on a finished list. */
export interface RunControl {
  status: ControlStatus;
  /** Display name of the reviewer, or null while PENDING. */
  by: string | null;
  at: string | null;
  note: string | null;
}

export interface RunItemStateRecord {
  itemCode: string;
  answer?: 'JA' | 'NEJ' | 'INGET_BEHOV' | null;
  answerCode?: string | null;
  note?: string | null;
  fields?: Record<string, string | number | null>;
  answeredBy?: string | null;
  answeredAt?: string | null;
}

export interface AnswerPatch {
  itemCode: string;
  answer?: 'JA' | 'NEJ' | 'INGET_BEHOV' | null;
  answerCode?: string | null;
  note?: string | null;
  fields?: Record<string, string | number | null>;
}

export interface RunRepository {
  /** Finds today's run for this list, or opens one. */
  openRun(input: {
    templateCode: string;
    templateVersion: number;
    businessDate: string;
    shift: ShiftCode;
    userId: string;
  }): Promise<RunDetail>;

  getRun(runId: string): Promise<RunDetail | null>;

  saveAnswer(runId: string, patch: AnswerPatch, userId: string, answeredAt: Date): Promise<void>;

  signRun(
    runId: string,
    input: {
      slot: number;
      userId: string;
      username: string;
      displayName: string;
      contentHash: string;
      signatureHash: string;
      snapshot: unknown;
    },
  ): Promise<void>;

  /**
   * Records the group leader's review of a submitted run.
   *
   * Writes the verdict onto the run and a signature row with purpose
   * 'LEADER_CONTROL', so a review is as tamper-evident as the original
   * sign-off rather than a status field anyone could flip.
   */
  controlRun(
    runId: string,
    input: {
      status: Exclude<ControlStatus, 'PENDING'>;
      note: string | null;
      userId: string;
      username: string;
      displayName: string;
      contentHash: string;
      signatureHash: string;
      snapshot: unknown;
    },
  ): Promise<void>;

  listRunsForDate(businessDate: string): Promise<RunDetail[]>;
}

/* -------------------------------------------------------------------------- */
/* Evidence                                                                   */
/* -------------------------------------------------------------------------- */

export interface AttachmentMeta {
  id: string;
  itemCode: string;
  groupKey: string | null;
  contentType: string;
  byteSize: number;
  uploadedAt: string;
}

export interface EvidenceRepository {
  addAttachment(input: {
    runId: string;
    itemCode: string;
    groupKey: string | null;
    contentType: string;
    bytes: Buffer;
    sha256: string;
    uploadedBy: string;
  }): Promise<AttachmentMeta>;

  listAttachments(runId: string): Promise<AttachmentMeta[]>;
  readAttachment(id: string): Promise<{ contentType: string; bytes: Buffer } | null>;
  deleteAttachment(id: string, userId: string): Promise<void>;
}
