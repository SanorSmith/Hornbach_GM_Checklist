import { and, desc, eq, gte, inArray, lte } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { getDb, schema } from '@/lib/db/client';
import { storeId } from './postgres-store';
import type {
  AnswerPatch,
  RunDetail,
  RunItemStateRecord,
  RunRepository,
  RunSigner,
} from './types';

/** Numeric fields come back from Postgres as strings; keep them numbers here. */
function readFieldValue(row: {
  valueText: string | null;
  valueNumeric: string | null;
  valueUserId: string | null;
}): string | number | null {
  if (row.valueNumeric !== null) return Number(row.valueNumeric);
  if (row.valueUserId !== null) return row.valueUserId;
  return row.valueText;
}

async function loadRun(runId: string): Promise<RunDetail | null> {
  const db = getDb();

  const [run] = await db
    .select()
    .from(schema.checklistRuns)
    .where(eq(schema.checklistRuns.id, runId))
    .limit(1);
  if (!run) return null;

  const itemRows = await db
    .select()
    .from(schema.runItems)
    .where(eq(schema.runItems.runId, runId));

  const fieldRows =
    itemRows.length > 0
      ? await db.select().from(schema.runItemFieldValues)
      : [];

  const items: RunItemStateRecord[] = itemRows.map((row) => {
    const fields: Record<string, string | number | null> = {};
    for (const field of fieldRows) {
      if (field.runItemId === row.id) fields[field.fieldKey] = readFieldValue(field);
    }
    return {
      itemCode: row.itemCode,
      answer: row.answer,
      answerCode: row.answerCode,
      note: row.note,
      fields,
      answeredBy: row.answeredBy,
      answeredAt: row.answeredAt?.toISOString() ?? null,
    };
  });

  const signatureRows = await db
    .select()
    .from(schema.signatures)
    .where(eq(schema.signatures.runId, runId));

  const signatures = signatureRows.map((s) => ({
    slot: s.slot,
    userId: s.userId,
    purpose: s.purpose,
    username: s.username,
    displayName: s.displayName,
    signedAt: s.signedAt.toISOString(),
    signatureHash: s.signatureHash,
    drawnSignature: s.drawnSignature,
  }));

  return {
    id: run.id,
    templateCode: run.templateCode,
    templateVersion: run.templateVersion,
    businessDate: run.businessDate,
    shift: run.shift,
    status: run.status === 'SUBMITTED' ? 'SUBMITTED' : 'OPEN',
    createdBy: run.createdBy,
    items,
    signatures,
    control: {
      status: run.controlStatus,
      // Taken from the control signature rather than joining users: the
      // signature already records who reviewed it, under a name frozen at the
      // time, which is the name that belongs on the record.
      by: signatures.find((sig) => sig.purpose === 'LEADER_CONTROL')?.displayName ?? null,
      at: run.controlledAt?.toISOString() ?? null,
      note: run.controlNote,
    },
  };
}

export const postgresRunRepository: RunRepository = {
  async openRun({ templateCode, templateVersion, businessDate, shift, userId }) {
    const db = getDb();
    const store = await storeId();

    const [existing] = await db
      .select({ id: schema.checklistRuns.id })
      .from(schema.checklistRuns)
      .where(
        and(
          eq(schema.checklistRuns.storeId, store),
          eq(schema.checklistRuns.templateCode, templateCode),
          eq(schema.checklistRuns.businessDate, businessDate),
        ),
      )
      .limit(1);

    if (existing) {
      const run = await loadRun(existing.id);
      if (run) return run;
    }

    // Two people opening the morning list at 06:00 must land on the same run,
    // not two half-finished ones — hence the unique index and DO NOTHING.
    const inserted = await db
      .insert(schema.checklistRuns)
      .values({
        storeId: store,
        templateCode,
        templateVersion,
        businessDate,
        shift,
        createdBy: userId,
      })
      .onConflictDoNothing()
      .returning({ id: schema.checklistRuns.id });

    const id = inserted[0]?.id;
    if (id) {
      const run = await loadRun(id);
      if (run) return run;
    }

    // Lost the race: the other writer's run is the one to use.
    const [raced] = await db
      .select({ id: schema.checklistRuns.id })
      .from(schema.checklistRuns)
      .where(
        and(
          eq(schema.checklistRuns.storeId, store),
          eq(schema.checklistRuns.templateCode, templateCode),
          eq(schema.checklistRuns.businessDate, businessDate),
        ),
      )
      .limit(1);
    if (!raced) throw new Error('Kunde inte öppna listan.');

    const run = await loadRun(raced.id);
    if (!run) throw new Error('Kunde inte läsa listan.');
    return run;
  },

  getRun: loadRun,

  async saveAnswer(runId, patch: AnswerPatch, userId, answeredAt) {
    const db = getDb();

    const [run] = await db
      .select({ status: schema.checklistRuns.status })
      .from(schema.checklistRuns)
      .where(eq(schema.checklistRuns.id, runId))
      .limit(1);
    if (!run) throw new Error('Listan finns inte.');
    if (run.status === 'SUBMITTED') throw new Error('Listan är redan signerad.');

    const [item] = await db
      .insert(schema.runItems)
      .values({
        runId,
        itemCode: patch.itemCode,
        ...(patch.answer !== undefined ? { answer: patch.answer } : {}),
        ...(patch.answerCode !== undefined ? { answerCode: patch.answerCode } : {}),
        ...(patch.note !== undefined ? { note: patch.note } : {}),
        status: 'ANSWERED',
        answeredBy: userId,
        answeredAt,
        clientAnsweredAt: answeredAt,
      })
      .onConflictDoUpdate({
        target: [schema.runItems.runId, schema.runItems.itemCode],
        set: {
          ...(patch.answer !== undefined ? { answer: patch.answer } : {}),
          ...(patch.answerCode !== undefined ? { answerCode: patch.answerCode } : {}),
          ...(patch.note !== undefined ? { note: patch.note } : {}),
          status: 'ANSWERED',
          answeredBy: userId,
          answeredAt,
          clientAnsweredAt: answeredAt,
        },
      })
      .returning({ id: schema.runItems.id });

    const runItemId = item?.id;
    if (!runItemId || !patch.fields) return;

    for (const [fieldKey, value] of Object.entries(patch.fields)) {
      const numeric = typeof value === 'number' ? String(value) : null;
      await db
        .insert(schema.runItemFieldValues)
        .values({
          runItemId,
          fieldKey,
          fieldType: numeric !== null ? 'DECIMAL' : 'TEXT',
          valueNumeric: numeric,
          valueText: numeric === null && value !== null ? String(value) : null,
        })
        .onConflictDoUpdate({
          target: [schema.runItemFieldValues.runItemId, schema.runItemFieldValues.fieldKey],
          set: {
            valueNumeric: numeric,
            valueText: numeric === null && value !== null ? String(value) : null,
          },
        });
    }
  },

  async signRun(runId, input) {
    const db = getDb();
    // The unique index on (run, slot, purpose) is what actually prevents a
    // double signature; this is the friendly error before it fires.
    await db.insert(schema.signatures).values({
      runId,
      slot: input.slot,
      purpose: 'WORKER_SUBMIT',
      userId: input.userId,
      username: input.username,
      displayName: input.displayName,
      contentHash: input.contentHash,
      signatureHash: input.signatureHash,
      drawnSignature: input.drawnSignature ?? null,
      drawnSignatureSha256: input.drawnSignatureSha256 ?? null,
      snapshot: input.snapshot as object,
    });

    await db
      .update(schema.checklistRuns)
      .set({ status: 'SUBMITTED', submittedAt: new Date() })
      .where(eq(schema.checklistRuns.id, runId));
  },

  async controlRun(runId, input) {
    const db = getDb();
    // Same unique index as the worker's signature, different purpose, so a
    // second review of the same run is refused by the database.
    await db.insert(schema.signatures).values({
      runId,
      slot: 1,
      purpose: 'LEADER_CONTROL',
      userId: input.userId,
      username: input.username,
      displayName: input.displayName,
      contentHash: input.contentHash,
      signatureHash: input.signatureHash,
      snapshot: input.snapshot as object,
    });

    await db
      .update(schema.checklistRuns)
      .set({
        controlStatus: input.status,
        controlledBy: input.userId,
        controlledAt: new Date(),
        controlNote: input.note,
      })
      .where(eq(schema.checklistRuns.id, runId));
  },

  async listRunsBetween(from, to) {
    const db = getDb();
    const store = await storeId();

    // One query with two joins rather than loading each run: a year of
    // reporting is a few thousand rows, and none of their answers are wanted.
    const performer = alias(schema.users, 'performer');
    const controller = alias(schema.users, 'controller');

    const rows = await db
      .select({
        id: schema.checklistRuns.id,
        templateCode: schema.checklistRuns.templateCode,
        businessDate: schema.checklistRuns.businessDate,
        status: schema.checklistRuns.status,
        submittedAt: schema.checklistRuns.submittedAt,
        performedById: schema.checklistRuns.createdBy,
        performedByName: performer.displayName,
        controlStatus: schema.checklistRuns.controlStatus,
        controlledAt: schema.checklistRuns.controlledAt,
        controlNote: schema.checklistRuns.controlNote,
        controlledByName: controller.displayName,
      })
      .from(schema.checklistRuns)
      .leftJoin(performer, eq(performer.id, schema.checklistRuns.createdBy))
      .leftJoin(controller, eq(controller.id, schema.checklistRuns.controlledBy))
      .where(
        and(
          eq(schema.checklistRuns.storeId, store),
          gte(schema.checklistRuns.businessDate, from),
          lte(schema.checklistRuns.businessDate, to),
        ),
      )
      .orderBy(desc(schema.checklistRuns.businessDate));

    // Signatures come separately rather than as a third join. A run can carry
    // more than one worker signature — GM_LF_KVALL has two assignee slots —
    // and joining them in would return that run twice, inflating every count
    // in the report by one per extra signer.
    const signers = new Map<string, RunSigner[]>();
    if (rows.length > 0) {
      const signer = alias(schema.users, 'signer');
      const signatureRows = await db
        .select({
          runId: schema.signatures.runId,
          userId: schema.signatures.userId,
          slot: schema.signatures.slot,
          signedAt: schema.signatures.signedAt,
          displayName: signer.displayName,
        })
        .from(schema.signatures)
        .leftJoin(signer, eq(signer.id, schema.signatures.userId))
        .where(
          and(
            inArray(
              schema.signatures.runId,
              rows.map((r) => r.id),
            ),
            // The workers' own sign-offs; a leader's control signature lives in
            // the same table and is not the same act.
            eq(schema.signatures.purpose, 'WORKER_SUBMIT'),
          ),
        )
        .orderBy(schema.signatures.slot);

      for (const s of signatureRows) {
        signers.set(s.runId, [
          ...(signers.get(s.runId) ?? []),
          {
            userId: s.userId,
            slot: s.slot,
            displayName: s.displayName,
            signedAt: s.signedAt.toISOString(),
          },
        ]);
      }
    }

    return rows.map((r) => ({
      id: r.id,
      templateCode: r.templateCode,
      businessDate: r.businessDate,
      status: r.status === 'SUBMITTED' ? ('SUBMITTED' as const) : ('OPEN' as const),
      performedById: r.performedById,
      performedByName: r.performedByName,
      signers: signers.get(r.id) ?? [],
      submittedAt: r.submittedAt?.toISOString() ?? null,
      controlStatus: r.controlStatus,
      controlledByName: r.controlledByName,
      controlledAt: r.controlledAt?.toISOString() ?? null,
      controlNote: r.controlNote,
    }));
  },

  async listRunsForDate(businessDate) {
    const db = getDb();
    const store = await storeId();
    const rows = await db
      .select({ id: schema.checklistRuns.id })
      .from(schema.checklistRuns)
      .where(
        and(
          eq(schema.checklistRuns.storeId, store),
          eq(schema.checklistRuns.businessDate, businessDate),
        ),
      );

    const runs = await Promise.all(rows.map((r) => loadRun(r.id)));
    return runs.filter((r): r is RunDetail => r !== null);
  },
};
