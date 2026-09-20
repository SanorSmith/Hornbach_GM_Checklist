import { NextResponse } from 'next/server';
import { AuthError, requireUser } from '@/lib/auth/guard';
import { repository } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Marks a notification as seen. Scoped to its recipient by the repository. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireUser();
    const { id } = await params;
    await repository().ackNotification(id, session.userId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}
