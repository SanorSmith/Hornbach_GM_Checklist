import { createHash } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError, requireUser } from '@/lib/auth/guard';
import { getTemplate } from '@/lib/checklists';
import { repository } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Compressed on the device to roughly 250 KB; this is a generous ceiling. */
const MAX_BYTES = 3 * 1024 * 1024;
const ALLOWED = new Set(['image/webp', 'image/jpeg', 'image/png']);

const Body = z.object({
  itemCode: z.string().min(1).max(128),
  groupKey: z.string().max(64).nullable().optional(),
  /** data:image/webp;base64,… */
  dataUrl: z.string().min(32).max(8 * 1024 * 1024),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const session = await requireUser();
    const { runId } = await params;

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Ogiltig bild.' }, { status: 400 });
    }

    const match = /^data:([\w/+.-]+);base64,(.+)$/s.exec(parsed.data.dataUrl);
    if (!match?.[1] || !match[2]) {
      return NextResponse.json({ ok: false, error: 'Ogiltigt bildformat.' }, { status: 400 });
    }

    const contentType = match[1];
    if (!ALLOWED.has(contentType)) {
      return NextResponse.json(
        { ok: false, error: 'Endast WebP, JPEG eller PNG.' },
        { status: 415 },
      );
    }

    const bytes = Buffer.from(match[2], 'base64');
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_BYTES) {
      return NextResponse.json({ ok: false, error: 'Bilden är för stor.' }, { status: 413 });
    }

    const repo = repository();
    const run = await repo.getRun(runId);
    if (!run) {
      return NextResponse.json({ ok: false, error: 'Listan finns inte.' }, { status: 404 });
    }
    if (run.status === 'SUBMITTED') {
      return NextResponse.json(
        { ok: false, error: 'Listan är signerad och kan inte ändras.' },
        { status: 409 },
      );
    }

    const template = getTemplate(run.templateCode);
    if (!template?.items.some((i) => i.code === parsed.data.itemCode)) {
      return NextResponse.json(
        { ok: false, error: 'Punkten hör inte till den här listan.' },
        { status: 400 },
      );
    }

    const attachment = await repo.addAttachment({
      runId,
      itemCode: parsed.data.itemCode,
      groupKey: parsed.data.groupKey ?? null,
      contentType,
      bytes,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      uploadedBy: session.userId,
    });

    await repo.appendAudit({
      actorUserId: session.userId,
      actorUsername: session.username,
      action: 'attachment.add',
      entityType: 'attachment',
      entityId: attachment.id,
      after: { runId, itemCode: parsed.data.itemCode, groupKey: parsed.data.groupKey ?? null },
    });

    return NextResponse.json({ ok: true, attachment });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}

/** Lists the photos attached to a run, so the client can refresh its counts. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    await requireUser();
    const { runId } = await params;
    const attachments = await repository().listAttachments(runId);
    return NextResponse.json({ ok: true, attachments });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}
