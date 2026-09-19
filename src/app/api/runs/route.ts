import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError, requireUser } from '@/lib/auth/guard';
import { getSeed, getTemplate } from '@/lib/checklists';
import { STORE_TIME_ZONE } from '@/lib/config';
import { repository } from '@/lib/repo';
import { businessDateOf } from '@/lib/rules/time';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({ templateCode: z.string().min(1).max(64) });

/** Opens today's run for a list, or returns the one already in progress. */
export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Ogiltig begäran.' }, { status: 400 });
    }

    const template = getTemplate(parsed.data.templateCode);
    const seed = getSeed(parsed.data.templateCode);
    if (!template || !seed) {
      return NextResponse.json({ ok: false, error: 'Okänd checklista.' }, { status: 404 });
    }

    const run = await repository().openRun({
      templateCode: template.code,
      templateVersion: template.version,
      businessDate: businessDateOf(new Date(), STORE_TIME_ZONE),
      shift: template.shift,
      userId: session.userId,
    });

    return NextResponse.json({ ok: true, runId: run.id });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}
