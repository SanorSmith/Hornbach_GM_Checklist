import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardTitle } from '@/components/ui/card';
import { DemoBanner } from '@/components/layout/demo-banner';
import { Topbar } from '@/components/layout/topbar';
import { requireLeaderOrRedirect } from '@/lib/auth/guard';
import { STORE_TIME_ZONE } from '@/lib/config';
import { t } from '@/lib/i18n';
import { buildHistoryReport, type HistoryReport, type Period } from '@/lib/reports/history';
import { buildPeopleReport, type PeopleReport } from '@/lib/reports/people';
import { businessDateOf } from '@/lib/rules/time';
import { formatDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type View = 'list' | 'person';

const PERIODS: { value: Period; label: string }[] = [
  { value: 'week', label: t('rep.week') },
  { value: 'month', label: t('rep.month') },
  { value: 'year', label: t('rep.year') },
];

const VIEWS: { value: View; label: string }[] = [
  { value: 'list', label: t('rep.byList') },
  { value: 'person', label: t('rep.byPerson') },
];

function fill(key: Parameters<typeof t>[0], values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [k, v]) => text.replace(`{${k}}`, String(v)), t(key));
}

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <dt>{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}

function Tabs({
  hrefFor,
  options,
  active,
}: {
  hrefFor: (value: string) => string;
  options: { value: string; label: string }[];
  active: string;
}) {
  return (
    <div className="flex gap-2">
      {options.map((option) => (
        <Link
          key={option.value}
          href={hrefFor(option.value)}
          className={
            option.value === active
              ? 'gm-btn gm-btn-primary min-h-touch px-4 text-sm'
              : 'gm-btn gm-btn-secondary min-h-touch px-4 text-sm'
          }
        >
          {option.label}
        </Link>
      ))}
    </div>
  );
}

/** Per checklist: what was done, what was signed late, what is still unreviewed. */
function ByList({ report }: { report: HistoryReport }) {
  return (
    <>
      <h2 className="gm-section-title mb-3 text-base">{t('rep.perList')}</h2>
      <ul className="space-y-3">
        {report.lists.map((list) => (
          <li key={list.code}>
            <Card>
              <CardBody>
                <CardTitle className="truncate">{list.nameSv}</CardTitle>
                <dl className="gm-muted mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums">
                  <Figure
                    label={t('rep.started')}
                    value={
                      <>
                        {list.started}{' '}
                        <span className="font-normal">
                          {fill('rep.ofDays', { days: list.expected })}
                        </span>
                      </>
                    }
                  />
                  <Figure label={t('rep.signed')} value={list.signed} />
                  <Figure label={t('rep.late')} value={list.signedLate} />
                  <Figure label={t('rep.awaiting')} value={list.awaitingControl} />
                  <Figure label={t('rep.ok')} value={list.controlOk} />
                  <Figure
                    label={t('control.notOk')}
                    value={list.controlNotOk + list.controlFollowUp}
                  />
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

                  {/* Straight to the filed copy: the next question after "what
                      went wrong" is always "what did the list actually say". */}
                  <Link
                    href={`/protokoll/${d.runId}`}
                    className="mt-2 inline-flex min-h-touch items-center gap-1 text-sm font-semibold text-[hsl(var(--gm-brand))] focus-visible:rounded-gm"
                  >
                    {t('prot.open')}
                  </Link>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * The same period grouped by person.
 *
 * Each figure names one act, and the note above the cards says which — because
 * "signerade" here counts the person's own signature, not every list they
 * touched, and nobody reading a column of numbers would guess that.
 */
function ByPerson({ report }: { report: PeopleReport }) {
  return (
    <>
      <h2 className="gm-section-title mb-1 text-base">{t('rep.byPerson')}</h2>
      <p className="gm-muted mb-3 text-xs">{t('rep.personNote')}</p>

      {report.people.length === 0 ? (
        <p className="gm-muted text-sm">{t('rep.noPeople')}</p>
      ) : (
        <ul className="space-y-3">
          {report.people.map((person) => (
            <li key={person.userId}>
              <Card
                className={person.deviations > 0 ? 'border-[hsl(var(--gm-danger))]' : undefined}
              >
                <CardBody>
                  <CardTitle className="truncate">{person.displayName}</CardTitle>
                  <dl className="gm-muted mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm tabular-nums">
                    <Figure label={t('rep.assigned')} value={person.assigned} />
                    <Figure label={t('rep.assignedNotSigned')} value={person.assignedNotSigned} />
                    <Figure label={t('rep.opened')} value={person.opened} />
                    <Figure label={t('rep.signedBy')} value={person.signed} />
                    <Figure label={t('rep.late')} value={person.signedLate} />
                    <Figure label={t('rep.ok')} value={person.controlOk} />
                    <Figure label={t('rep.deviationsOn')} value={person.deviations} />
                  </dl>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/**
 * History over a period, per checklist or per person.
 *
 * Per checklist is the operational view and the default. Per person is an
 * appraisal of named employees, which is a different thing with different
 * obligations — so it sits behind its own tab, entered deliberately, and every
 * figure is counted against the act it actually describes rather than rolled
 * into a score.
 */
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; view?: string }>;
}) {
  const session = await requireLeaderOrRedirect();
  const { period: rawPeriod, view: rawView } = await searchParams;
  const period: Period = rawPeriod === 'month' || rawPeriod === 'year' ? rawPeriod : 'week';
  const view: View = rawView === 'person' ? 'person' : 'list';

  const today = businessDateOf(new Date(), STORE_TIME_ZONE);
  const report = await buildHistoryReport(period, today);
  const people = view === 'person' ? await buildPeopleReport(period, today) : null;

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

        <div className="mb-3">
          <Tabs
            options={VIEWS}
            active={view}
            hrefFor={(value) => `/rapporter?period=${period}&view=${value}`}
          />
        </div>
        <div className="mb-5">
          <Tabs
            options={PERIODS}
            active={period}
            hrefFor={(value) => `/rapporter?period=${value}&view=${view}`}
          />
        </div>

        {people ? <ByPerson report={people} /> : <ByList report={report} />}
      </main>
    </>
  );
}
