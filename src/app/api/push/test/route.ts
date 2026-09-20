import { NextResponse } from 'next/server';
import { AuthError, requireUser } from '@/lib/auth/guard';
import { pushIsConfigured, sendTestPush } from '@/lib/notifications/push';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Sends a test push to the caller's own devices, and nobody else's. */
export async function POST() {
  try {
    const session = await requireUser();
    if (!pushIsConfigured()) {
      return NextResponse.json(
        { ok: false, error: 'Push är inte konfigurerat på servern.' },
        { status: 503 },
      );
    }

    const result = await sendTestPush(session.userId);
    if (result.sent === 0) {
      return NextResponse.json(
        {
          ok: false,
          error:
            result.pruned > 0
              ? 'Prenumerationen har gått ut. Slå på notiser igen.'
              : 'Inga enheter är registrerade för notiser.',
          ...result,
        },
        { status: 409 },
      );
    }

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}
