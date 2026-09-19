import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardTitle } from '@/components/ui/card';
import { CHECKLIST_CATALOGUE } from '@/lib/checklists';
import { t } from '@/lib/i18n';

/**
 * Placeholder landing page for the scaffold. The real worker flow ("pick your
 * list → guided run → sign") replaces this in the next phase; what it shows now
 * is the catalogue of the four paper lists this system is built to replace.
 */
export default function HomePage() {
  return (
    <main className="gm-shell py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-black tracking-tight">{t('app.name')}</h1>
        <p className="gm-muted mt-1">{t('app.tagline')}</p>
      </header>

      <div className="gm-panel mb-6 text-sm">{t('phase.scaffold')}</div>

      <h2 className="gm-section-title mb-3">{t('worker.pickList')}</h2>

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
    </main>
  );
}
