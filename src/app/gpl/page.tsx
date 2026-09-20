import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardTitle } from '@/components/ui/card';
import { DemoBanner } from '@/components/layout/demo-banner';
import { Topbar } from '@/components/layout/topbar';
import { requireLeaderOrRedirect } from '@/lib/auth/guard';
import { STORE_TIME_ZONE } from '@/lib/config';
import { t } from '@/lib/i18n';
import { businessDateOf } from '@/lib/rules/time';
import { buildSupervisorOverview, type ChecklistOverview } from '@/lib/supervisor/overview';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<ChecklistOverview['status'], string> = {
  NOT_STARTED: t('gpl.notStarted'),
  IN_PROGRESS: t('gpl.inProgress'),
  READY_TO_SIGN: t('gpl.readyToSign'),
  SIGNED: t('gpl.signed'),
};

function fill(key: Parameters<typeof t>[0], values: Record<string, string | number>): string {
  return Object.entries(values).reduce(
    (text, [k, v]) => text.replace(`{${k}}`, String(v)),
    t(key),
  );
}

/**
 * The group leader's view of the day: every checklist, who has it, how far it
 * has got, and what is late.
 *
 * Built from the catalogue rather than from the runs, because the state that
 * matters most — nobody has started the evening list — has no run to list.
 */
export default async function SupervisorPage() {
  const session = await requireLeaderOrRedirect();

  const businessDate = businessDateOf(new Date(), STORE_TIME_ZONE);
  const overview = await buildSupervisorOverview(businessDate, new Date());

  return (
    <>
      <DemoBanner />
      <Topbar
        displayName={session.displayName}
        username={session.username}
        roles={session.roles}
      />

      <main className="gm-shell py-6">
        <h1 className="gm-section-title">{t('gpl.title')}</h1>
        <p className="gm-muted mb-1 text-sm">{formatDate(businessDate)}</p>
        <p className="gm-muted mb-4 text-sm">
          {fill('gpl.summary', {
            notStarted: overview.totals.notStarted,
            inProgress: overview.totals.inProgress + overview.totals.readyToSign,
            signed: overview.totals.signed,
          })}
        </p>

        <ul className="space-y-3">
          {overview.checklists.map((list) => {
            const percent =
              list.progress.applicable === 0
                ? 0
                : (list.progress.answered / list.progress.applicable) * 100;

            const card = (
              <Card
                className={
                  list.isLate
                    ? 'border-[hsl(var(--gm-danger))]'
                    : list.status === 'SIGNED'
                      ? 'border-[hsl(var(--gm-success))]'
                      : undefined
                }
              >
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{list.nameSv}</CardTitle>
                      <p className="gm-muted mt-1 text-sm">
                        {list.roleSv} · {list.windowSv}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge>{STATUS_LABEL[list.status]}</Badge>
                      {list.isLate && <Badge>{t('gpl.late')}</Badge>}
                    </div>
                  </div>

                  {list.status !== 'NOT_STARTED' && (
                    <>
                      <div className="progress mt-3">
                        <div style={{ width: `${percent}%` }} />
                      </div>
                      <p className="gm-muted mt-1 text-xs">
                        {fill('gpl.answeredOf', {
                          answered: list.progress.answered,
                          total: list.progress.applicable,
                        })}
                        {list.progress.blocked > 0 &&
                          ` · ${fill('gpl.blocked', { count: list.progress.blocked })}`}
                        {list.progress.overdue > 0 &&
                          ` · ${fill('gpl.overdueItems', { count: list.progress.overdue })}`}
                      </p>
                    </>
                  )}

                  <p className="gm-muted mt-2 text-sm">
                    {list.status === 'SIGNED' && list.signedBy
                      ? `${t('gpl.signedBy')} ${list.signedBy}`
                      : list.performedBy
                        ? `${t('gpl.performedBy')} ${list.performedBy}`
                        : t('gpl.nobodyStarted')}
                  </p>
                </CardBody>
              </Card>
            );

            // Only linked once a run exists. /lista/[code] opens a run as a side
            // effect, so linking an unstarted list would quietly make the group
            // leader its owner just for looking.
            return (
              <li key={list.code}>
                {list.runId ? (
                  <Link
                    href={`/lista/${list.code}`}
                    className="block focus-visible:rounded-gm"
                    aria-label={`${t('gpl.open')}: ${list.nameSv}`}
                  >
                    <div className="relative">
                      {card}
                      <ChevronRight
                        className="gm-muted absolute right-3 top-1/2 h-5 w-5 -translate-y-1/2"
                        aria-hidden
                      />
                    </div>
                  </Link>
                ) : (
                  card
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
