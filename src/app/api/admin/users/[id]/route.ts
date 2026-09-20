import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError, requireRole } from '@/lib/auth/guard';
import { ROLES } from '@/lib/auth/types';
import { repository } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  roles: z.array(z.enum(ROLES)).min(1).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireRole('ADMIN');
    const { id } = await context.params;

    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success || (!parsed.data.roles && parsed.data.isActive === undefined)) {
      return NextResponse.json({ ok: false, error: 'Ogiltig begäran.' }, { status: 400 });
    }

    const repo = repository();
    const target = await repo.findUserById(id);
    if (!target) {
      return NextResponse.json({ ok: false, error: 'Okänd användare.' }, { status: 404 });
    }

    // An admin who removes their own ADMIN role, or deactivates themselves,
    // locks everyone out of user administration with no way back in.
    const losingOwnAdmin =
      target.id === session.userId &&
      ((parsed.data.roles !== undefined && !parsed.data.roles.includes('ADMIN')) ||
        parsed.data.isActive === false);
    if (losingOwnAdmin) {
      return NextResponse.json(
        { ok: false, error: 'Du kan inte ta bort din egen administratörsbehörighet.' },
        { status: 409 },
      );
    }

    if (parsed.data.roles) await repo.setUserRoles(id, parsed.data.roles);
    if (parsed.data.isActive !== undefined) await repo.setUserActive(id, parsed.data.isActive);

    await repo.appendAudit({
      actorUserId: session.userId,
      actorUsername: session.username,
      action: parsed.data.roles ? 'USER_ROLES_CHANGED' : 'USER_ACTIVE_CHANGED',
      entityType: 'user',
      entityId: id,
      before: { roles: target.roles, isActive: target.isActive },
      after: {
        roles: parsed.data.roles ?? target.roles,
        isActive: parsed.data.isActive ?? target.isActive,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}
