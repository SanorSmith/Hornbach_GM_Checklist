import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { AuthError, requireRole } from '@/lib/auth/guard';
import { hashSecret } from '@/lib/auth/password';
import { repository } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const newPin = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

/** Issues a fresh PIN and clears any lockout. Shown once, never recoverable. */
export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole('ADMIN');
    const { id } = await context.params;

    const repo = repository();
    const target = await repo.findUserById(id);
    if (!target) {
      return NextResponse.json({ ok: false, error: 'Okänd användare.' }, { status: 404 });
    }

    const pin = newPin();
    await repo.setUserPin(id, await hashSecret(pin));

    await repo.appendAudit({
      actorUserId: session.userId,
      actorUsername: session.username,
      action: 'USER_PIN_RESET',
      entityType: 'user',
      entityId: id,
      // The PIN itself is deliberately absent: the audit log records that it
      // changed, not what it became.
      after: { username: target.username },
    });

    return NextResponse.json({ ok: true, pin });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}
