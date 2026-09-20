import type { AuthUser, Role, SessionRecord } from '@/lib/auth/types';

/**
 * The data access boundary.
 *
 * Two implementations exist: `postgres` whenever DATABASE_URL is set, and
 * `memory` when it is not, so the app is usable before the database is linked.
 * The in-memory one is also the fixture the tests run against, which is why
 * this interface is worth having rather than calling drizzle directly.
 */

/* -------------------------------------------------------------------------- */
/* Assignments                                                                */
/* -------------------------------------------------------------------------- */

/** Who is expected to do a checklist today, as opposed to who did. */
export interface Assignment {
  templateCode: string;
  slot: number;
  assignedTo: string;
  /** Display name, resolved for rendering. */
  assignedToName: string;
  assignedAt: string;
}

/**
 * A run as reporting needs it: one row, no items, no attachments.
 *
 * Separate from RunDetail because that loads every answer and every photo for
 * a single run. A month of reporting wants four hundred runs and none of their
 * contents.
 */
/** One worker's sign-off on a run, with the time they put their own name to it. */
export interface RunSigner {
  userId: string;
  slot: number;
  displayName: string | null;
  signedAt: string;
}

export interface RunSummaryRecord {
  id: string;
  templateCode: string;
  businessDate: string;
  status: 'OPEN' | 'SUBMITTED';
  /** Who opened the list. */
  performedById: string | null;
  performedByName: string | null;
  /**
   * Who signed it, which is not always who opened it — one worker can start a
   * list and another finish it. Kept apart so a report cannot put one person's
   * lateness against another's name.
   *
   * A list, not one name: GM_LF_KVALL has two assignee slots and is signed by
   * two different people, and crediting only the first would quietly erase the
   * second person's work from every report about them.
   */
  signers: RunSigner[];
  submittedAt: string | null;
  controlStatus: ControlStatus;
  controlledByName: string | null;
  controlledAt: string | null;
  controlNote: string | null;
}

export interface AssignmentRepository {
  listAssignments(businessDate: string): Promise<Assignment[]>;
  /** Inclusive on both ends, for reporting. */
  listAssignmentsBetween(from: string, to: string): Promise<(Assignment & { businessDate: string })[]>;
  /** Replaces any existing assignment for the same list, day and slot. */
  setAssignment(input: {
    businessDate: string;
    templateCode: string;
    slot: number;
    assignedTo: string;
    assignedBy: string;
  }): Promise<void>;
  clearAssignment(input: {
    businessDate: string;
    templateCode: string;
    slot: number;
  }): Promise<void>;
}


/* -------------------------------------------------------------------------- */
/* Notifications                                                              */
/* -------------------------------------------------------------------------- */

export interface NotificationRecord {
  id: string;
  templateCode: string;
  kind: string;
  state: string;
  payload: { listName?: string; dueAt?: string; assigneeName?: string | null } | null;
  createdAt: string;
}

export interface NewNotification {
  businessDate: string;
  templateCode: string;
  slot: number;
  recipientId: string;
  kind: string;
  payload: unknown;
}

/** Enough to match a created row back to the item that produced it. */
export interface CreatedNotificationKey {
  templateCode: string;
  slot: number;
  recipientId: string;
  kind: string;
}

export interface NotificationRepository {
  /**
   * Records notifications, ignoring any the recipient already has.
   *
   * Returns the ones that were actually new. Callers push only those — the
   * check runs on every supervisor page load, and pushing everything it
   * considered would notify the same person the same thing all afternoon.
   */
  createNotifications(items: readonly NewNotification[]): Promise<CreatedNotificationKey[]>;
  listNotifications(recipientId: string, businessDate: string): Promise<NotificationRecord[]>;
  ackNotification(id: string, recipientId: string): Promise<void>;
}


/* -------------------------------------------------------------------------- */
/* Push subscriptions                                                         */
/* -------------------------------------------------------------------------- */

export interface PushSubscriptionRecord {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushRepository {
  /** Upserts on endpoint: re-subscribing a browser refreshes its keys. */
  savePushSubscription(input: {
    userId: string;
    endpoint: string;
    p256dh: string;
    auth: string;
    deviceLabel: string | null;
  }): Promise<void>;
  listPushSubscriptions(userIds: readonly string[]): Promise<PushSubscriptionRecord[]>;
  /** Called when the push service reports the endpoint is gone. */
  deletePushSubscription(endpoint: string): Promise<void>;
}

export interface Repository extends RunRepository, EvidenceRepository, AssignmentRepository, NotificationRepository, PushRepository {
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
  /** Grouping a per-person report by display name would break on a rename. */
  userId: string;
  /** 'WORKER_SUBMIT' for the person who did the list, 'LEADER_CONTROL' for the review. */
  purpose: string;
  username: string;
  displayName: string;
  signedAt: string;
  signatureHash: string;
  /**
   * The name written with a finger, base64 PNG — the mark the paper carried.
   * Null for a signature taken without one, which is still a valid signature.
   */
  drawnSignature: string | null;
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
      /** Base64 PNG of the name drawn on the glass, when there is one. */
      drawnSignature?: string | null;
      drawnSignatureSha256?: string | null;
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

  /** Inclusive on both ends, for reporting over a week, month or year. */
  listRunsBetween(from: string, to: string): Promise<RunSummaryRecord[]>;
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
