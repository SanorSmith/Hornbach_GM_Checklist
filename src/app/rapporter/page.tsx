import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardTitle } from '@/components/ui/card';
import { DemoBanner } from '@/components/layout/demo-banner';
import { Topbar } from '@/components/layout/topbar';
import { requireLeaderOrRedirect } from '@/lib/auth/guard';
import { STORE_TIME_ZONE } from '@/lib/config';
import { t } from '@/lib/i18n';
import { buildHistoryReport, type Period } from '@/lib/reports/history';
import { businessDateOf } from '@/lib/rules/time';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: t('rep.week') },
  { value: 'month', label: t('rep.month') },
  { value: 'year', label: t('rep.year') },
];

function fill(key: Parameters<typeof t>[0], values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [k, v]) => text.replace(`{${k}}`, String(v)), t(key));
}

/**
 * History over a period, reported per checklist.
 *
 * Deliberately not per person. The same query grouped by name is an appraisal
 * rather than an operational report, and that is a decision for the business to
 * take knowingly rather than one to arrive at by accident. Names appear against
 * individual deviations so a leader knows who to ask, which is not the same as
 * scoring anyone.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await requireLeaderOrRedirect();
  const { period: raw } = await searchParams;
  const period: Period = raw === 'month' || raw === 'year' ? raw : 'week';

  const today = businessDateOf(new Date(), STORE_TIME_ZONE);
  const report = await buildHistoryReport(period, today);

  return (
    <>
      <DemoBanner />
      <Topbar
        displayName={session.displayName}
        username={session.username}
        roles={session.roles}
      />

      <main className="gm-shell py-6">
        <h1 className="gm-section-title">{t('rep.title')}</h1>
        <p className="gm-muted mb-3 text-sm">
          {fill('rep.range', { from: formatDate(report.from), to: formatDate(report.to) })}
        </p>

        <div className="mb-5 flex gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={`/rapporter?period=${p.value}`}
              className={
                p.value === period
                  ? 'gm-btn gm-btn-primary min-h-touch px-4 text-sm'
                  : 'gm-btn gm-btn-secondary min-h-touch px-4 text-sm'
              }
            >
              {p.label}
            </Link>
          ))}
        </div>

        <h2 className="gm-section-title mb-3 text-base">{t('rep.perList')}</h2>
        <ul className="space-y-3">
          {report.lists.map((list) => (
            <li key={list.code}>
              <Card>
                <CardBody>
                  <CardTitle className="truncate">{list.nameSv}</CardTitle>
                  <dl className="gm-muted mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums">
                    <div className="flex justify-between gap-2">
                      <dt>{t('rep.started')}</dt>
                      <dd className="font-semibold">
                        {list.started} <span className="font-normal">{fill('rep.ofDays', { days: list.expected })}</span>
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>{t('rep.signed')}</dt>
                      <dd className="font-semibold">{list.signed}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>{t('rep.late')}</dt>
                      <dd className="font-semibold">{list.signedLate}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>{t('rep.awaiting')}</dt>
                      <dd className="font-semibold">{list.awaitingControl}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>{t('rep.ok')}</dt>
                      <dd className="font-semibold">{list.controlOk}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>{t('control.notOk')}</dt>
                      <dd className="font-semibold">{list.controlNotOk + list.controlFollowUp}</dd>
                    </div>
                  </dl>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>

        <h2 className="gm-section-title mb-3 mt-8 text-base">
          {t('rep.deviations')}
          {report.deviations.length > 0 && ` (${report.deviations.length})`}
        </h2>

        {report.deviations.length === 0 ? (
          <p className="gm-muted text-sm">{t('rep.noDeviations')}</p>
        ) : (
          <ul className="space-y-3">
            {report.deviations.map((d, i) => (
              <li key={`${d.businessDate}-${d.templateCode}-${i}`}>
                <Card className="border-[hsl(var(--gm-danger))]">
                  <CardBody>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate">{d.nameSv}</CardTitle>
                        <p className="gm-muted text-sm">{formatDate(d.businessDate)}</p>
                      </div>
                      <Badge>
                        {d.status === 'NOT_OK' ? t('control.notOk') : t('control.followUp')}
                      </Badge>
                    </div>

                    <p className="mt-2 text-sm">{d.note ?? t('rep.noNote')}</p>

                    <p className="gm-muted mt-2 text-xs">
                      {d.performedByName && `${t('rep.doneBy')} ${d.performedByName}`}
                      {d.performedByName && d.controlledByName && ' · '}
                      {d.controlledByName && `${t('rep.reviewedBy')} ${d.controlledByName}`}
                    </p>
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
