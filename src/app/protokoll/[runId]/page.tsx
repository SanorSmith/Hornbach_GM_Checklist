import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DemoBanner } from '@/components/layout/demo-banner';
import { PrintButton } from '@/components/reports/print-button';
import { RecordPhotos } from '@/components/reports/record-photos';
import { requireLeaderOrRedirect } from '@/lib/auth/guard';
import { t } from '@/lib/i18n';
import type { ControlStatus } from '@/lib/repo/types';
import { buildRunRecord, type RecordItem, type RecordSection } from '@/lib/reports/record';
import { formatDate, formatDateTime, formatTime } from '@/lib/utils';

export const dynamic = 'force-dynamic';

const CONTROL_LABEL: Record<ControlStatus, string> = {
  PENDING: t('control.pending'),
  OK: t('control.ok'),
  NOT_OK: t('control.notOk'),
  FOLLOW_UP: t('control.followUp'),
};

function fill(key: Parameters<typeof t>[0], values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [k, v]) => text.replace(`{${k}}`, String(v)), t(key));
}

/** One point, laid out the way the paper form reads: number, question, answer. */
function Item({ item }: { item: RecordItem }) {
  return (
    <li className="gm-print-item border-t border-[hsl(var(--gm-border))] py-3 first:border-t-0">
      <div className="flex gap-3">
        <span className="w-6 shrink-0 font-semibold tabular-nums">{item.ordinal}.</span>
        <div className="min-w-0 flex-1">
          <p>{item.textSv}</p>

          {item.helpSv && <p className="gm-muted mt-1 text-xs">{item.helpSv}</p>}

          <p className="mt-1 text-sm">
            <span className="gm-muted">{t('prot.answer')}: </span>
            <span className="font-semibold">{item.answerSv ?? t('prot.blank')}</span>
            {item.answeredAt && (
              <span className="gm-muted"> · {formatTime(item.answeredAt)}</span>
            )}
            {item.controlGroupSv && (
              <span className="gm-muted"> · {item.controlGroupSv}</span>
            )}
          </p>

          {item.fields.map((field) => (
            <p key={field.key} className="mt-1 text-sm">
              <span className="gm-muted">{field.labelSv}: </span>
              <span className="font-semibold">{field.value ?? t('prot.blank')}</span>
            </p>
          ))}

          {item.note && (
            <p className="mt-1 text-sm">
              <span className="gm-muted">{t('prot.note')}: </span>
              {item.note}
            </p>
          )}

          <RecordPhotos
            photos={item.photos}
            caption={`${item.ordinal}. ${item.textSv}`}
            countLabel={fill('prot.photoCount', { count: item.photos.length })}
          />
        </div>
      </div>
    </li>
  );
}

function Section({ section }: { section: RecordSection }) {
  return (
    <section className="gm-print-section mt-6">
      <h2 className="text-base font-bold">
        {section.titleSv}
        {section.windowSv && !section.titleSv.includes(section.windowSv) && (
          <span className="gm-muted font-normal"> · {section.windowSv}</span>
        )}
      </h2>
      {section.noteSv && <p className="gm-muted mt-1 text-sm">{section.noteSv}</p>}

      <ul className="mt-2 border border-[hsl(var(--gm-border))] px-3">
        {section.items.map((item) => (
          <Item key={item.code} item={item} />
        ))}
      </ul>
    </section>
  );
}

/**
 * The filed copy of one finished checklist.
 *
 * This is the page that replaces the binder: everything the paper sheet used to
 * carry, in the paper sheet's own order, on A4 when printed. It is read-only by
 * construction — there is no route from here that writes anything — because a
 * record that can be edited from the screen it is read on is not a record.
 */
export default async function RecordPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  await requireLeaderOrRedirect(`/protokoll/${runId}`);

  const record = await buildRunRecord(runId);
  if (!record) notFound();

  const reviewed = record.control.status !== 'PENDING';

  return (
    <>
      <div className="gm-no-print">
        <DemoBanner />
      </div>

      <header className="gm-no-print border-b border-[hsl(var(--gm-border))] bg-[hsl(var(--gm-surface))]">
        <div className="gm-shell flex items-center gap-2 py-2">
          <Link href="/protokoll" className="gm-btn-ghost min-h-touch px-2" aria-label={t('prot.back')}>
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-bold leading-tight">{t('prot.title')}</h1>
            <p className="gm-muted truncate text-xs leading-tight">{record.nameSv}</p>
          </div>
          <PrintButton />
        </div>
      </header>

      <main className="gm-shell gm-print-sheet py-6">
        <h1 className="text-xl font-bold">{record.nameSv}</h1>
        <p className="gm-muted mt-1 text-sm">
          {record.roleSv} · {formatDate(record.businessDate)}
        </p>
        <p className="gm-muted mt-1 text-sm">
          {fill('prot.answeredOf', { answered: record.answered, total: record.total })}
        </p>

        {record.status !== 'SUBMITTED' && (
          <p className="mt-3 border border-[hsl(var(--gm-danger))] p-2 text-sm font-semibold">
            {t('prot.notSigned')}
          </p>
        )}

        {!record.templateVersionMatches && (
          <p className="mt-3 border border-[hsl(var(--gm-border))] p-2 text-sm">
            {fill('prot.versionChanged', {
              run: record.runTemplateVersion,
              now: record.currentTemplateVersion,
            })}
          </p>
        )}

        {record.sections.map((section) => (
          <Section key={section.id} section={section} />
        ))}

        {record.footerNotesSv && (
          <p className="gm-muted mt-6 text-sm">{record.footerNotesSv}</p>
        )}

        <section className="gm-print-section mt-8">
          <h2 className="text-base font-bold">{t('prot.signatures')}</h2>
          {record.signatures.length === 0 ? (
            <p className="gm-muted mt-1 text-sm">{t('prot.noSignatures')}</p>
          ) : (
            <ul className="mt-2 space-y-3 text-sm">
              {record.signatures.map((signature) => (
                <li key={`${signature.slot}-${signature.username}`}>
                  {/* The written name sits above the line, as it did on the
                      sheet. It is the human-readable face of the signature;
                      the hash underneath is what actually proves it. */}
                  {signature.drawnSignature && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={`data:image/png;base64,${signature.drawnSignature}`}
                      alt={`Namnteckning, ${signature.displayName}`}
                      className="gm-print-photo mb-1 h-16 w-auto max-w-[16rem] border-b border-[hsl(var(--gm-border))]"
                    />
                  )}
                  <span className="font-semibold">{signature.displayName}</span>
                  <span className="gm-muted"> ({signature.username})</span>
                  {signature.slotLabelSv && (
                    <span className="gm-muted"> · {signature.slotLabelSv}</span>
                  )}
                  <span className="gm-muted">
                    {' '}
                    · {t('prot.signedAt')} {formatDateTime(signature.signedAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="gm-print-section mt-6">
          <h2 className="text-base font-bold">{t('prot.control')}</h2>
          {reviewed ? (
            <div className="mt-2 text-sm">
              <Badge>{CONTROL_LABEL[record.control.status]}</Badge>
              <p className="mt-1">
                <span className="gm-muted">{t('rep.reviewedBy')} </span>
                <span className="font-semibold">{record.control.by}</span>
                {record.control.at && (
                  <span className="gm-muted"> · {formatDateTime(record.control.at)}</span>
                )}
              </p>
              {record.control.note && <p className="mt-1">{record.control.note}</p>}
            </div>
          ) : (
            <p className="gm-muted mt-1 text-sm">{t('prot.controlPending')}</p>
          )}
        </section>

        <p className="gm-muted mt-8 border-t border-[hsl(var(--gm-border))] pt-2 text-xs">
          {t('prot.filedBy')}
        </p>
      </main>
    </>
  );
}
