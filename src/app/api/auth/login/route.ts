import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticate } from '@/lib/auth/authenticate';
import { SESSION_TTL_HOURS, readSession } from '@/lib/auth/session';
import { repository } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  username: z.string().min(1).max(64),
  pin: z.string().min(4).max(8),
  deviceKey: z.string().max(128).optional(),
});

export async function POST(request: Request) {
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: 'INVALID_INPUT' }, { status: 400 });
  }

  const result = await authenticate(parsed.data.username, parsed.data.pin);

  if (!result.ok) {
    // 401 for every credential failure, including "no such user": the status
    // and body must not let a caller enumerate usernames.
    const status = result.reason === 'INVALID_INPUT' ? 400 : 401;
    return NextResponse.json(
      {
        ok: false,
        reason: result.reason,
        ...(result.reason === 'LOCKED' ? { until: result.until.toISOString() } : {}),
      },
      { status },
    );
  }

  const repo = repository();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000);
  const record = await repo.createSession({
    userId: result.user.id,
    deviceId: null,
    expiresAt,
    userAgent: request.headers.get('user-agent'),
  });

  const session = await readSession();
  session.sessionId = record.id;
  session.userId = result.user.id;
  session.storeId = result.user.storeId;
  session.roles = result.user.roles;
  session.username = result.user.username;
  session.displayName = result.user.displayName;
  // Assume shared until device registration says otherwise — the safer default
  // for a handheld that passes between shifts.
  session.deviceShared = true;
  await session.save();

  await repo.appendAudit({
    actorUserId: result.user.id,
    actorUsername: result.user.username,
    action: 'auth.login',
    entityType: 'session',
    entityId: record.id,
  });

  return NextResponse.json({
    ok: true,
    user: {
      id: result.user.id,
      username: result.user.username,
      displayName: result.user.displayName,
      roles: result.user.roles,
    },
  });
}
