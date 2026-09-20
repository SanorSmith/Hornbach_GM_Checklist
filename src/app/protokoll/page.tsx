import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardTitle } from '@/components/ui/card';
import { DemoBanner } from '@/components/layout/demo-banner';
import { Topbar } from '@/components/layout/topbar';
import { requireLeaderOrRedirect } from '@/lib/auth/guard';
import { CHECKLIST_CATALOGUE } from '@/lib/checklists';
import { STORE_TIME_ZONE } from '@/lib/config';
import { t } from '@/lib/i18n';
import type { ControlStatus } from '@/lib/repo/types';
import { repository } from '@/lib/repo';
import { rangeFor, type Period } from '@/lib/reports/history';
import { businessDateOf } from '@/lib/rules/time';
import { formatDate, formatDateTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: t('rep.week') },
  { value: 'month', label: t('rep.month') },
  { value: 'year', label: t('rep.year') },
];

const CONTROL_LABEL: Record<ControlStatus, string> = {
  PENDING: t('control.pending'),
  OK: t('control.ok'),
  NOT_OK: t('control.notOk'),
  FOLLOW_UP: t('control.followUp'),
};

function fill(key: Parameters<typeof t>[0], values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [k, v]) => text.replace(`{${k}}`, String(v)), t(key));
}

/**
 * The archive: every signed checklist in the period, newest first.
 *
 * Only signed ones. A half-finished list is something to chase on the day, and
 * it belongs on the supervisor's screen — filing it as a record would put an
 * unfinished form in the binder, which is the thing the paper system got wrong.
 */
export default async function ArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const session = await requireLeaderOrRedirect('/protokoll');
  const { period: rawPeriod } = await searchParams;
  const period: Period = rawPeriod === 'month' || rawPeriod === 'year' ? rawPeriod : 'week';

  const today = businessDateOf(new Date(), STORE_TIME_ZONE);
  const { from, to } = rangeFor(period, today);
  const runs = (await repository().listRunsBetween(from, to)).filter(
    (r) => r.status === 'SUBMITTED',
  );

  const nameByCode = new Map(CHECKLIST_CATALOGUE.map((c) => [c.code, c.nameSv]));

  return (
    <>
      <DemoBanner />
      <Topbar
        displayName={session.displayName}
        username={session.username}
        roles={session.roles}
      />

      <main className="gm-shell py-6">
        <h1 className="gm-section-title">{t('prot.archive')}</h1>
        <p className="gm-muted mb-1 text-sm">{t('prot.archiveIntro')}</p>
        <p className="gm-muted mb-3 text-sm">
          {fill('rep.range', { from: formatDate(from), to: formatDate(to) })}
        </p>

        <div className="mb-5 flex gap-2">
          {PERIODS.map((p) => (
            <Link
              key={p.value}
              href={`/protokoll?period=${p.value}`}
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

        {runs.length === 0 ? (
          <p className="gm-muted text-sm">{t('prot.none')}</p>
        ) : (
          <ul className="space-y-3">
            {runs.map((run) => (
              <li key={run.id}>
                <Card
                  className={
                    run.controlStatus === 'NOT_OK' || run.controlStatus === 'FOLLOW_UP'
                      ? 'border-[hsl(var(--gm-danger))]'
                      : undefined
                  }
                >
                  <CardBody>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <CardTitle className="truncate">
                          {nameByCode.get(run.templateCode) ?? run.templateCode}
                        </CardTitle>
                        <p className="gm-muted mt-1 text-sm">{formatDate(run.businessDate)}</p>
                      </div>
                      <Badge>{CONTROL_LABEL[run.controlStatus]}</Badge>
                    </div>

                    <p className="gm-muted mt-2 text-sm">
                      {run.signers.length > 0
                        ? `${t('prot.signatures')}: ${run.signers
                            .map((s) => s.displayName ?? '—')
                            .join(', ')}`
                        : t('prot.noSignatures')}
                    </p>
                    {run.submittedAt && (
                      <p className="gm-muted text-sm">
                        {t('prot.signedAt')} {formatDateTime(run.submittedAt)}
                      </p>
                    )}

                    <Link
                      href={`/protokoll/${run.id}`}
                      className="mt-3 inline-flex min-h-touch items-center gap-1 text-sm font-semibold text-[hsl(var(--gm-brand))] focus-visible:rounded-gm"
                    >
                      {t('prot.open')}
                      <ChevronRight className="h-4 w-4" aria-hidden />
                    </Link>
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
