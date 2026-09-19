import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError, requireUser } from '@/lib/auth/guard';
import { getTemplate } from '@/lib/checklists';
import { repository } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  itemCode: z.string().min(1).max(128),
  answer: z.enum(['JA', 'NEJ', 'INGET_BEHOV']).nullable().optional(),
  answerCode: z.string().max(4).nullable().optional(),
  note: z.string().max(4000).nullable().optional(),
  fields: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).optional(),
});

/** Records one answer. Answers are saved as they are given, not on submit. */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  try {
    const session = await requireUser();
    const { runId } = await params;

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Ogiltigt svar.' }, { status: 400 });
    }

    const repo = repository();
    const run = await repo.getRun(runId);
    if (!run) {
      return NextResponse.json({ ok: false, error: 'Listan finns inte.' }, { status: 404 });
    }
    if (run.status === 'SUBMITTED') {
      return NextResponse.json(
        { ok: false, error: 'Listan är redan signerad och kan inte ändras.' },
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

    await repo.saveAnswer(runId, parsed.data, session.userId, new Date());

    await repo.appendAudit({
      actorUserId: session.userId,
      actorUsername: session.username,
      action: 'run_item.answer',
      entityType: 'run_item',
      after: { runId, ...parsed.data },
    });

    const updated = await repo.getRun(runId);
    return NextResponse.json({ ok: true, items: updated?.items ?? [] });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}
