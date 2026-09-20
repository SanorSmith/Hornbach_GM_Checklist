import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError, requireUser } from '@/lib/auth/guard';
import { getSeed, getTemplate } from '@/lib/checklists';
import { STORE_TIME_ZONE } from '@/lib/config';
import { repository } from '@/lib/repo';
import { evaluateRun } from '@/lib/rules';
import { toEngineItems } from '@/lib/runs/engine-input';
import { buildSnapshot, contentHashOf, drawingHashOf, signatureHashOf } from '@/lib/signature';
import { zonedToInstant } from '@/lib/rules/time';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * `drawing` is the name written on the glass: base64 PNG, no data-URL prefix.
 *
 * Capped at 512 KB of base64. A finger-drawn name is a few kilobytes; anything
 * approaching the cap is not a signature, and the column is not an image
 * store. Optional throughout — a signature without a drawing is still a
 * signature, and nobody should be unable to finish a shift because a
 * touchscreen would not cooperate.
 */
const DRAWING_MAX_BASE64 = 512 * 1024;

const Body = z.object({
  slot: z.number().int().min(1).max(2).default(1),
  drawing: z
    .string()
    .regex(/^[A-Za-z0-9+/]+={0,2}$/, 'Namnteckningen kunde inte läsas.')
    .max(DRAWING_MAX_BASE64, 'Namnteckningen är för stor.')
    .nullish(),
});

/**
 * Signs a run.
 *
 * The engine is re-run server-side before the signature is accepted. A client
 * that decided it could submit — because it was offline with stale rules, or
 * because someone tampered with the request — does not get to sign an
 * incomplete checklist.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const session = await requireUser();
    const { runId } = await params;
    const parsed = Body.safeParse(await request.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, error: parsed.error.issues[0]?.message ?? 'Ogiltig begäran.' },
        { status: 400 },
      );
    }
    const { slot } = parsed.data;
    const drawing = parsed.data.drawing ?? null;

    const repo = repository();
    const run = await repo.getRun(runId);
    if (!run) {
      return NextResponse.json({ ok: false, error: 'Listan finns inte.' }, { status: 404 });
    }

    const template = getTemplate(run.templateCode);
    const seed = getSeed(run.templateCode);
    if (!template || !seed) {
      return NextResponse.json({ ok: false, error: 'Okänd checklista.' }, { status: 404 });
    }

    const attachments = await repo.listAttachments(runId);

    const evaluation = evaluateRun({
      template,
      run: {
        businessDate: run.businessDate,
        shift: run.shift,
        timeZone: STORE_TIME_ZONE,
        shiftStartAt: zonedToInstant(run.businessDate, seed.shiftStart, STORE_TIME_ZONE).toISOString(),
        shiftEndAt: zonedToInstant(run.businessDate, seed.shiftEnd, STORE_TIME_ZONE).toISOString(),
      },
      items: toEngineItems(template, run.items, attachments),
      now: new Date(),
    });

    if (!evaluation.canSubmit) {
      const outstanding = Object.values(evaluation.byItem)
        .filter((e) => e.errors.length > 0)
        .map((e) => ({ code: e.code, errors: e.errors }));
      return NextResponse.json(
        { ok: false, error: 'Listan är inte komplett.', outstanding },
        { status: 422 },
      );
    }

    const signedAt = new Date().toISOString();
    const snapshot = buildSnapshot(template, run);
    const contentHash = contentHashOf(snapshot);
    const deviceLabel = request.headers.get('user-agent')?.slice(0, 120) ?? 'okänd enhet';

    // Sealed into the signature hash rather than stored beside it, so the
    // drawing cannot later be swapped for somebody else's.
    const drawingHash = drawing ? drawingHashOf(drawing) : null;

    await repo.signRun(runId, {
      slot,
      userId: session.userId,
      username: session.username,
      displayName: session.displayName,
      contentHash,
      signatureHash: signatureHashOf({
        contentHash,
        username: session.username,
        signedAt,
        deviceLabel,
        drawingHash,
      }),
      snapshot,
      drawnSignature: drawing,
      drawnSignatureSha256: drawingHash,
    });

    await repo.appendAudit({
      actorUserId: session.userId,
      actorUsername: session.username,
      action: 'run.sign',
      entityType: 'run',
      after: { runId, contentHash, slot, drawnSignature: drawingHash !== null },
    });

    return NextResponse.json({ ok: true, contentHash });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Signeringen misslyckades.';
    return NextResponse.json({ ok: false, error: message }, { status: 409 });
  }
}
