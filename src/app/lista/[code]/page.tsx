import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { IdleGuard } from '@/components/auth/idle-guard';
import { DemoBanner } from '@/components/layout/demo-banner';
import { RunView } from '@/components/worker/run-view';
import { requireUserOrRedirect } from '@/lib/auth/guard';
import { getSeed, getTemplate } from '@/lib/checklists';
import { STORE_TIME_ZONE } from '@/lib/config';
import { repository } from '@/lib/repo';
import { businessDateOf, zonedToInstant } from '@/lib/rules/time';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export default async function RunPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const session = await requireUserOrRedirect(`/lista/${code}`);

  const template = getTemplate(code);
  const seed = getSeed(code);
  if (!template || !seed) notFound();

  const businessDate = businessDateOf(new Date(), STORE_TIME_ZONE);

  // Opening is idempotent: two people starting the morning list land on the
  // same run rather than two half-finished ones.
  const repo = repository();
  const run = await repo.openRun({
    templateCode: template.code,
    templateVersion: template.version,
    businessDate,
    shift: template.shift,
    userId: session.userId,
  });
  const attachments = await repo.listAttachments(run.id);

  return (
    <>
      <DemoBanner />
      <header className="border-b border-[hsl(var(--gm-border))] bg-[hsl(var(--gm-surface))]">
        <div className="gm-shell flex items-center gap-2 py-2">
          <Link href="/" className="gm-btn-ghost min-h-touch px-2" aria-label="Tillbaka">
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight">{template.nameSv}</h1>
            <p className="gm-muted truncate text-xs leading-tight">
              {formatDate(businessDate)} · Genomförs av {session.displayName} ({session.username})
            </p>
          </div>
        </div>
      </header>

      <RunView
        template={template}
        run={run}
        initialAttachments={attachments}
        canSign
        context={{
          businessDate,
          shift: template.shift,
          timeZone: STORE_TIME_ZONE,
          shiftStartAt: zonedToInstant(businessDate, seed.shiftStart, STORE_TIME_ZONE).toISOString(),
          shiftEndAt: zonedToInstant(businessDate, seed.shiftEnd, STORE_TIME_ZONE).toISOString(),
        }}
      />

      <IdleGuard shared={session.deviceShared} />
    </>
  );
}
