import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError, requireRole } from '@/lib/auth/guard';
import { getTemplate } from '@/lib/checklists';
import { repository } from '@/lib/repo';
import { buildSnapshot, contentHashOf, signatureHashOf } from '@/lib/signature';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  status: z.enum(['OK', 'NOT_OK', 'FOLLOW_UP']),
  note: z.string().trim().max(2000).optional(),
});

/**
 * Efterkontroll: the group leader's review of a finished list.
 *
 * Signed the same way the worker's sign-off is, with purpose 'LEADER_CONTROL',
 * so the review is as tamper-evident as the work it reviews. A status column
 * anyone could flip would not be worth much as a control.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const session = await requireRole('GROUP_LEADER');
    const { runId } = await params;

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Ogiltig begäran.' }, { status: 400 });
    }
    const { status } = parsed.data;
    const note = parsed.data.note?.trim() ?? '';

    // A verdict of "not OK" without a reason tells the next shift nothing, which
    // is the same failure the paper form's "skriv varför" was trying to prevent.
    if (status !== 'OK' && note.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'Skriv vad som är fel eller ska följas upp.' },
        { status: 400 },
      );
    }

    const repo = repository();
    const run = await repo.getRun(runId);
    if (!run) {
      return NextResponse.json({ ok: false, error: 'Listan finns inte.' }, { status: 404 });
    }
    if (run.status !== 'SUBMITTED') {
      return NextResponse.json(
        { ok: false, error: 'Listan är inte inlämnad än.' },
        { status: 409 },
      );
    }
    if (run.control.status !== 'PENDING') {
      return NextResponse.json(
        { ok: false, error: 'Listan är redan efterkontrollerad.' },
        { status: 409 },
      );
    }

    const template = getTemplate(run.templateCode);
    if (!template) {
      return NextResponse.json({ ok: false, error: 'Okänd checklista.' }, { status: 404 });
    }

    // The reviewer signs the run exactly as it stood when reviewed, so a later
    // edit to the answers cannot hide behind an approval given before it.
    const controlledAt = new Date().toISOString();
    const snapshot = buildSnapshot(template, run);
    const contentHash = contentHashOf(snapshot);
    const deviceLabel = request.headers.get('user-agent')?.slice(0, 120) ?? 'okänd enhet';

    await repo.controlRun(runId, {
      status,
      note: note.length > 0 ? note : null,
      userId: session.userId,
      username: session.username,
      displayName: session.displayName,
      contentHash,
      signatureHash: signatureHashOf({
        contentHash,
        username: session.username,
        signedAt: controlledAt,
        deviceLabel,
      }),
      snapshot,
    });

    await repo.appendAudit({
      actorUserId: session.userId,
      actorUsername: session.username,
      action: 'run.control',
      entityType: 'run',
      entityId: runId,
      before: { controlStatus: run.control.status },
      after: { controlStatus: status, contentHash, hasNote: note.length > 0 },
    });

    return NextResponse.json({ ok: true, status, contentHash });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : 'Efterkontrollen misslyckades.';
    return NextResponse.json({ ok: false, error: message }, { status: 409 });
  }
}
