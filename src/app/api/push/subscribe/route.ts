import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError, requireUser } from '@/lib/auth/guard';
import { repository } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
});

/** Stores this browser's push subscription against the signed-in user. */
export async function POST(request: Request) {
  try {
    const session = await requireUser();
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Ogiltig prenumeration.' }, { status: 400 });
    }

    await repository().savePushSubscription({
      userId: session.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.keys.p256dh,
      auth: parsed.data.keys.auth,
      deviceLabel: request.headers.get('user-agent')?.slice(0, 120) ?? null,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}

/** Removes it again — the user turning notifications off on this device. */
export async function DELETE(request: Request) {
  try {
    await requireUser();
    const parsed = Body.pick({ endpoint: true }).safeParse(
      await request.json().catch(() => null),
    );
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Ogiltig begäran.' }, { status: 400 });
    }

    await repository().deletePushSubscription(parsed.data.endpoint);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}
