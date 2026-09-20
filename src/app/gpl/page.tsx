import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardTitle } from '@/components/ui/card';
import { DemoBanner } from '@/components/layout/demo-banner';
import { NotificationBanner } from '@/components/layout/notification-banner';
import { Topbar } from '@/components/layout/topbar';
import { requireLeaderOrRedirect } from '@/lib/auth/guard';
import { STORE_TIME_ZONE } from '@/lib/config';
import { t } from '@/lib/i18n';
import { raiseOverdueNotifications } from '@/lib/notifications/raise';
import type { ControlStatus } from '@/lib/repo/types';
import { businessDateOf } from '@/lib/rules/time';
import { repository } from '@/lib/repo';
import { buildSupervisorOverview, type ChecklistOverview } from '@/lib/supervisor/overview';
import { formatDate } from '@/lib/utils';
import { AssignPicker, type AssignableUser } from './assign-picker';
import { ControlActions } from './control-actions';

export const dynamic = 'force-dynamic';

const STATUS_LABEL: Record<ChecklistOverview['status'], string> = {
  NOT_STARTED: t('gpl.notStarted'),
  IN_PROGRESS: t('gpl.inProgress'),
  READY_TO_SIGN: t('gpl.readyToSign'),
  SIGNED: t('gpl.signed'),
};

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
 * The group leader's view of the day: every checklist, who has it, how far it
 * has got, what is late, and what still needs efterkontroll.
 *
 * Built from the catalogue rather than from the runs, because the state that
 * matters most — nobody has started the evening list — has no run to list.
 */
export default async function SupervisorPage() {
  const session = await requireLeaderOrRedirect();

  const businessDate = businessDateOf(new Date(), STORE_TIME_ZONE);
  const overview = await buildSupervisorOverview(businessDate, new Date());

  // Only active accounts can be given work; a deactivated one would produce a
  // list nobody can do, and the API refuses it anyway.
  const users = await repository().listUsers();

  // The daily cron is the backstop; this is what makes a late list visible
  // while the shift is still running. Idempotent, and the overview it needs is
  // already built for the page.
  await raiseOverdueNotifications({
    businessDate,
    now: new Date(),
    checklists: overview.checklists,
    users,
  });

  const notifications = await repository().listNotifications(session.userId, businessDate);

  const assignable: AssignableUser[] = users
    .filter((u) => u.isActive)
    .map((u) => ({ id: u.id, displayName: u.displayName }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName, 'sv'));

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
        <h1 className="gm-section-title">{t('gpl.title')}</h1>
        <p className="gm-muted mb-1 text-sm">{formatDate(businessDate)}</p>
        <p className="gm-muted text-sm">
          {fill('gpl.summary', {
            notStarted: overview.totals.notStarted,
            inProgress: overview.totals.inProgress + overview.totals.readyToSign,
            signed: overview.totals.signed,
          })}
        </p>
        {overview.totals.unstartedButAssigned > 0 && (
          <p className="mt-1 text-sm font-semibold">
            {fill('assign.unstarted', { count: overview.totals.unstartedButAssigned })}
          </p>
        )}
        {overview.totals.awaitingControl > 0 && (
          <p className="mb-4 mt-1 text-sm font-semibold">
            {fill('control.awaiting', { count: overview.totals.awaitingControl })}
          </p>
        )}

        <ul className="mt-4 space-y-3">
          {overview.checklists.map((list) => {
            const percent =
              list.progress.applicable === 0
                ? 0
                : (list.progress.answered / list.progress.applicable) * 100;
            const awaitingControl = list.status === 'SIGNED' && list.control.status === 'PENDING';
            const reviewed = list.control.status !== 'PENDING';

            return (
              <li key={list.code}>
                <Card
                  className={
                    list.isLate || list.control.status === 'NOT_OK'
                      ? 'border-[hsl(var(--gm-danger))]'
                      : list.control.status === 'OK'
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
                        {reviewed && <Badge>{CONTROL_LABEL[list.control.status]}</Badge>}
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

                    <p className="gm-muted mt-1 text-sm">
                      {list.assignedTo
                        ? `${t('assign.label')}: ${list.assignedTo.name}`
                        : t('assign.notAssigned')}
                    </p>

                    {reviewed && (
                      <p className="gm-muted mt-1 text-sm">
                        {t('control.by')} {list.control.by}
                        {list.control.note && ` — ${list.control.note}`}
                      </p>
                    )}

                    {/* Only linked once a run exists. /lista/[code] opens a run
                        as a side effect, so linking an unstarted list would
                        quietly make the group leader its owner. */}
                    {list.runId && (
                      <Link
                        href={`/lista/${list.code}`}
                        className="mt-3 inline-flex min-h-touch items-center gap-1 text-sm font-semibold text-[hsl(var(--gm-brand))] focus-visible:rounded-gm"
                      >
                        {t('gpl.open')}
                        <ChevronRight className="h-4 w-4" aria-hidden />
                      </Link>
                    )}

                    {/* Assignment stays editable after work starts: shifts change
                        hands, and the record should follow. */}
                    {list.status !== 'SIGNED' && (
                      <AssignPicker
                        templateCode={list.code}
                        users={assignable}
                        current={list.assignedTo?.id ?? null}
                      />
                    )}

                    {awaitingControl && list.runId && <ControlActions runId={list.runId} />}
                  </CardBody>
                </Card>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
