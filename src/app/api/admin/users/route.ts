import { randomInt } from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError, requireRole } from '@/lib/auth/guard';
import { hashSecret, normaliseUsername } from '@/lib/auth/password';
import { ROLES } from '@/lib/auth/types';
import { listAdminUsers, toAdminUser } from '@/lib/admin/users';
import { repository } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  username: z.string().min(2).max(32),
  displayName: z.string().min(2).max(80),
  roles: z.array(z.enum(ROLES)).min(1),
});

/** Six digits from a CSPRNG, matching how `npm run seed` issues the first one. */
const newPin = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export async function GET() {
  try {
    await requireRole('ADMIN');
    return NextResponse.json({ ok: true, users: await listAdminUsers() });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireRole('ADMIN');
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Ogiltig begäran.' }, { status: 400 });
    }

    const username = normaliseUsername(parsed.data.username);
    if (!/^[a-z0-9._-]+$/.test(username)) {
      return NextResponse.json(
        { ok: false, error: 'Användarnamnet får bara innehålla a–z, 0–9, punkt, bindestreck.' },
        { status: 400 },
      );
    }

    const repo = repository();
    if (await repo.findUserByUsername(username)) {
      return NextResponse.json({ ok: false, error: 'Användarnamnet finns redan.' }, { status: 409 });
    }

    // Generated, never chosen: a PIN an admin picks is a PIN an admin knows.
    const pin = newPin();
    const user = await repo.createUser({
      username,
      displayName: parsed.data.displayName.trim(),
      roles: parsed.data.roles,
      pinHash: await hashSecret(pin),
    });

    await repo.appendAudit({
      actorUserId: session.userId,
      actorUsername: session.username,
      action: 'USER_CREATED',
      entityType: 'user',
      entityId: user.id,
      after: { username: user.username, displayName: user.displayName, roles: user.roles },
    });

    // The only time the PIN exists in readable form. It is not stored and
    // cannot be recovered — only replaced.
    return NextResponse.json({ ok: true, user: toAdminUser(user, Date.now()), pin });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}
