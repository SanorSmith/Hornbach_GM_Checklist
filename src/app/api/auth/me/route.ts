import { NextResponse } from 'next/server';
import { AuthError, requireUser } from '@/lib/auth/guard';
import { runMode } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Each route authorizes itself. Middleware guards pages, not /api.
    const session = await requireUser();
    return NextResponse.json({
      ok: true,
      mode: runMode(),
      user: {
        id: session.userId,
        username: session.username,
        displayName: session.displayName,
        roles: session.roles,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}
