import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError, requireUser } from '@/lib/auth/guard';
import { getSeed, getTemplate } from '@/lib/checklists';
import { STORE_TIME_ZONE } from '@/lib/config';
import { repository } from '@/lib/repo';
import { evaluateRun } from '@/lib/rules';
import { buildSnapshot, contentHashOf, signatureHashOf } from '@/lib/signature';
import { zonedToInstant } from '@/lib/rules/time';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ slot: z.number().int().min(1).max(2).default(1) });

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
    const slot = parsed.success ? parsed.data.slot : 1;

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

    const evaluation = evaluateRun({
      template,
      run: {
        businessDate: run.businessDate,
        shift: run.shift,
        timeZone: STORE_TIME_ZONE,
        shiftStartAt: zonedToInstant(run.businessDate, seed.shiftStart, STORE_TIME_ZONE).toISOString(),
        shiftEndAt: zonedToInstant(run.businessDate, seed.shiftEnd, STORE_TIME_ZONE).toISOString(),
      },
      items: run.items.map((i) => ({
        itemId: i.itemCode,
        answer: i.answer ?? null,
        answerCode: i.answerCode ?? null,
        note: i.note ?? null,
        fields: i.fields ?? {},
        answeredAt: i.answeredAt ?? null,
      })),
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
      }),
      snapshot,
    });

    await repo.appendAudit({
      actorUserId: session.userId,
      actorUsername: session.username,
      action: 'run.sign',
      entityType: 'run',
      after: { runId, contentHash, slot },
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
