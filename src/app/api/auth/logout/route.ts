import { NextResponse } from 'next/server';
import { currentSession } from '@/lib/auth/guard';
import { readSession } from '@/lib/auth/session';
import { repository } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const active = await currentSession();

  if (active) {
    const repo = repository();
    // Revoke the row as well as clearing the cookie: a cookie copied off the
    // device before sign-out must stop working too.
    await repo.revokeSession(active.sessionId);
    await repo.appendAudit({
      actorUserId: active.userId,
      actorUsername: active.username,
      action: 'auth.logout',
      entityType: 'session',
      entityId: active.sessionId,
    });
  }

  const session = await readSession();
  session.destroy();

  return NextResponse.json({ ok: true });
}
