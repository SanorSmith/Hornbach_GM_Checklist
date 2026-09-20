import { NextResponse } from 'next/server';
import { z } from 'zod';
import { AuthError, requireRole } from '@/lib/auth/guard';
import { getTemplate } from '@/lib/checklists';
import { STORE_TIME_ZONE } from '@/lib/config';
import { repository } from '@/lib/repo';
import { businessDateOf } from '@/lib/rules/time';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({
  templateCode: z.string().min(1).max(64),
  /** 2 is the evening list's "Person 2". */
  slot: z.number().int().min(1).max(2).default(1),
  /** Omitted on DELETE, which only needs to identify the slot. */
  assignedTo: z.string().uuid().optional(),
  businessDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

/** Assigns a checklist to someone for a day. Group leaders only. */
export async function POST(request: Request) {
  try {
    const session = await requireRole('GROUP_LEADER');
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success || !parsed.data.assignedTo) {
      return NextResponse.json({ ok: false, error: 'Ogiltig begäran.' }, { status: 400 });
    }

    const { templateCode, slot, assignedTo } = parsed.data;
    const businessDate = parsed.data.businessDate ?? businessDateOf(new Date(), STORE_TIME_ZONE);

    const template = getTemplate(templateCode);
    if (!template) {
      return NextResponse.json({ ok: false, error: 'Okänd checklista.' }, { status: 404 });
    }

    const repo = repository();
    const target = await repo.findUserById(assignedTo);
    if (!target) {
      return NextResponse.json({ ok: false, error: 'Okänd användare.' }, { status: 404 });
    }
    // Assigning work to a deactivated account creates a list nobody can do, and
    // nothing would say so until the shift ended.
    if (!target.isActive) {
      return NextResponse.json(
        { ok: false, error: 'Kontot är inaktiverat.' },
        { status: 409 },
      );
    }

    await repo.setAssignment({
      businessDate,
      templateCode,
      slot,
      assignedTo,
      assignedBy: session.userId,
    });

    await repo.appendAudit({
      actorUserId: session.userId,
      actorUsername: session.username,
      action: 'assignment.set',
      entityType: 'assignment',
      after: { businessDate, templateCode, slot, assignedTo: target.username },
    });

    return NextResponse.json({
      ok: true,
      assignment: {
        templateCode,
        slot,
        assignedTo,
        assignedToName: target.displayName,
      },
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}

/** Removes an assignment, leaving the checklist unassigned rather than deleted. */
export async function DELETE(request: Request) {
  try {
    const session = await requireRole('GROUP_LEADER');
    const parsed = Body.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Ogiltig begäran.' }, { status: 400 });
    }

    const { templateCode, slot } = parsed.data;
    const businessDate = parsed.data.businessDate ?? businessDateOf(new Date(), STORE_TIME_ZONE);

    const repo = repository();
    await repo.clearAssignment({ businessDate, templateCode, slot });

    await repo.appendAudit({
      actorUserId: session.userId,
      actorUsername: session.username,
      action: 'assignment.clear',
      entityType: 'assignment',
      before: { businessDate, templateCode, slot },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }
    throw error;
  }
}
