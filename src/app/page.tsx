import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardTitle } from '@/components/ui/card';
import { IdleGuard } from '@/components/auth/idle-guard';
import { DemoBanner } from '@/components/layout/demo-banner';
import { Topbar } from '@/components/layout/topbar';
import { requireUserOrRedirect } from '@/lib/auth/guard';
import { CHECKLIST_CATALOGUE } from '@/lib/checklists';
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

  return (
    <>
      <DemoBanner />
      <Topbar
        displayName={session.displayName}
        username={session.username}
        roles={session.roles}
      />

      <main className="gm-shell py-6">
        <h1 className="gm-section-title mb-4">{t('worker.pickList')}</h1>

        <ul className="space-y-3">
          {CHECKLIST_CATALOGUE.map((list) => (
            <li key={list.code}>
              <Card>
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{list.nameSv}</CardTitle>
                      <p className="gm-muted mt-1 text-sm">{list.roleSv}</p>
                    </div>
                    <Badge tone="brand">{t(`shift.${list.shift}`)}</Badge>
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
            </li>
          ))}
        </ul>

        <p className="gm-panel mt-6 text-sm">{t('phase.scaffold')}</p>
      </main>

      <IdleGuard shared={session.deviceShared} />
    </>
  );
}
