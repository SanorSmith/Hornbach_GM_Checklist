import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardTitle } from '@/components/ui/card';
import { IdleGuard } from '@/components/auth/idle-guard';
import { DemoBanner } from '@/components/layout/demo-banner';
import { NotificationBanner } from '@/components/layout/notification-banner';
import { Topbar } from '@/components/layout/topbar';
import { requireUserOrRedirect } from '@/lib/auth/guard';
import { CHECKLIST_CATALOGUE, SHIFT_MESSAGE_KEY } from '@/lib/checklists';
import { STORE_TIME_ZONE } from '@/lib/config';
import { repository } from '@/lib/repo';
import { businessDateOf } from '@/lib/rules/time';
import { t } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * "Vilka listor ska du göra idag?" — the worker's entry point.
 *
 * The guided run itself lands in the next phase; for now this confirms who is
 * signed in and shows the four lists the system covers.
 */
export default async function HomePage() {
  const session = await requireUserOrRedirect('/');

  // What this person was actually given today. Sorting theirs to the top is the
  // whole point: on a shared handheld the list of four looks identical to
  // everyone otherwise.
  const businessDate = businessDateOf(new Date(), STORE_TIME_ZONE);
  const assignments = await repository().listAssignments(businessDate);
  const notifications = await repository().listNotifications(session.userId, businessDate);
  const mine = new Set(
    assignments.filter((a) => a.assignedTo === session.userId).map((a) => a.templateCode),
  );
  const assignedElsewhere = new Map(
    assignments
      .filter((a) => a.assignedTo !== session.userId)
      .map((a) => [a.templateCode, a.assignedToName]),
  );

  const ordered = [...CHECKLIST_CATALOGUE].sort(
    (a, b) => Number(mine.has(b.code)) - Number(mine.has(a.code)),
  );

  return (
    <>
      <DemoBanner />
      <Topbar
        displayName={session.displayName}
        username={session.username}
        roles={session.roles}
      />

      <NotificationBanner items={notifications} />

      <main className="gm-shell py-6">
        <h1 className="gm-section-title mb-4">{t('worker.pickList')}</h1>

        <ul className="space-y-3">
          {ordered.map((list) => (
            <li key={list.code}>
              <Link href={`/lista/${list.code}`} className="block focus-visible:rounded-gm">
              <Card className="transition-colors hover:border-[hsl(var(--gm-brand))]">
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{list.nameSv}</CardTitle>
                      {mine.has(list.code) && (
                        <p className="mt-1">
                          <Badge tone="brand">{t('assign.mine')}</Badge>
                        </p>
                      )}
                      <p className="gm-muted mt-1 text-sm">
                        {assignedElsewhere.has(list.code)
                          ? `${list.roleSv} · ${t('assign.label')}: ${assignedElsewhere.get(list.code)}`
                          : list.roleSv}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Badge tone="brand">{t(SHIFT_MESSAGE_KEY[list.shift])}</Badge>
                      <ChevronRight className="h-5 w-5 opacity-50" aria-hidden />
                    </div>
                  </div>
                  <dl className="gm-muted mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm tabular-nums">
                    <div className="flex gap-1.5">
                      <dt>Punkter:</dt>
                      <dd className="font-semibold">{list.itemCount}</dd>
                    </div>
                    <div className="flex gap-1.5">
                      <dt>Tider:</dt>
                      <dd className="font-semibold">{list.windowSv}</dd>
                    </div>
                  </dl>
                </CardBody>
              </Card>
              </Link>
            </li>
          ))}
        </ul>

      </main>

      <IdleGuard shared={session.deviceShared} />
    </>
  );
}
