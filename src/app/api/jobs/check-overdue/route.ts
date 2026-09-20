import { NextResponse } from 'next/server';
import { STORE_TIME_ZONE } from '@/lib/config';
import { raiseOverdueNotifications } from '@/lib/notifications/raise';
import { repository } from '@/lib/repo';
import { businessDateOf } from '@/lib/rules/time';
import { buildSupervisorOverview } from '@/lib/supervisor/overview';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The daily sweep: catches lists nobody did and nobody looked at.
 *
 * Vercel's Hobby plan allows one cron run per day, which is too slow to tell
 * anyone while a shift is still running — so the same check also runs when a
 * group leader opens their overview. This endpoint is the backstop for the day
 * nobody opens the app at all.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Unauthenticated, this endpoint reports who is behind on their work.
    return NextResponse.json({ ok: false, error: 'CRON_SECRET is not set.' }, { status: 503 });
  }
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: 'Unauthorized.' }, { status: 401 });
  }

  const now = new Date();
  const businessDate = businessDateOf(now, STORE_TIME_ZONE);

  const [overview, users] = await Promise.all([
    buildSupervisorOverview(businessDate, now),
    repository().listUsers(),
  ]);

  const result = await raiseOverdueNotifications({
    businessDate,
    now,
    checklists: overview.checklists,
    users,
  });

  return NextResponse.json({ ok: true, businessDate, ...result });
}
