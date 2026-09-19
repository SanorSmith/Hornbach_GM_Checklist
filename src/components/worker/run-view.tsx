'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { evaluateRun } from '@/lib/rules';
import { mergeRules } from '@/lib/rules/merge';
import type { ResolvedTemplate, RunContext } from '@/lib/rules/types';
import type { RunDetail, RunItemStateRecord } from '@/lib/repo/types';
import { ItemCard } from './item-card';

/**
 * The guided run.
 *
 * The client re-runs the *same* pure engine the server uses on every keystroke,
 * so a worker sees immediately that a deadline has passed, that "hinner inte"
 * will not be accepted, or that a point is still locked behind another — rather
 * than finding out when they try to sign. Because it is literally the same
 * function, the two can never disagree about whether the list is complete.
 */
export function RunView({
  template,
  run,
  context,
  canSign,
}: {
  template: ResolvedTemplate;
  run: RunDetail;
  context: RunContext;
  canSign: boolean;
}) {
  const router = useRouter();
  const [items, setItems] = useState<RunItemStateRecord[]>(run.items);
  const [now, setNow] = useState(() => new Date());
  const [saving, setSaving] = useState(false);
  const [signError, setSignError] = useState<string | null>(null);
  const signed = run.status === 'SUBMITTED';

  // Deadlines are the whole point of this screen, so the countdowns must move.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const evaluation = useMemo(
    () =>
      evaluateRun({
        template,
        run: context,
        items: items.map((i) => ({
          itemId: i.itemCode,
          answer: i.answer ?? null,
          answerCode: i.answerCode ?? null,
          note: i.note ?? null,
          fields: i.fields ?? {},
          answeredAt: i.answeredAt ?? null,
        })),
        now,
      }),
    [template, context, items, now],
  );

  const mergedRules = useMemo(() => {
    const map = new Map<string, ReturnType<typeof mergeRules>>();
    for (const item of template.items) {
      const section = template.sections.find((s) => s.id === item.sectionId);
      map.set(item.code, mergeRules(template.defaults, section?.rules, item.rules));
    }
    return map;
  }, [template]);

  const persist = useCallback(
    async (patch: RunItemStateRecord) => {
      setSaving(true);
      try {
        await fetch(`/api/runs/${run.id}/items`, {
          method: 'PUT',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            itemCode: patch.itemCode,
            answer: patch.answer ?? null,
            answerCode: patch.answerCode ?? null,
            note: patch.note ?? null,
            fields: patch.fields ?? {},
          }),
        });
      } finally {
        setSaving(false);
      }
    },
    [run.id],
  );

  const update = useCallback(
    (itemCode: string, patch: Partial<RunItemStateRecord>) => {
      setItems((previous) => {
        const existing = previous.find((i) => i.itemCode === itemCode);
        const merged: RunItemStateRecord = {
          ...(existing ?? { itemCode }),
          ...patch,
          itemCode,
          answeredAt: new Date().toISOString(),
        };
        // Saved as it is given, so a lost connection or a shift change never
        // costs the work already done.
        void persist(merged);
        return existing
          ? previous.map((i) => (i.itemCode === itemCode ? merged : i))
          : [...previous, merged];
      });
    },
    [persist],
  );

  const sign = async () => {
    setSignError(null);
    setSaving(true);
    try {
      const response = await fetch(`/api/runs/${run.id}/sign`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slot: 1 }),
      });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.ok) {
        router.refresh();
        return;
      }
      setSignError(body?.error ?? 'Signeringen misslyckades.');
    } catch {
      setSignError('Signeringen misslyckades.');
    } finally {
      setSaving(false);
    }
  };

  const { applicable, answered } = evaluation.progress;
  const percent = applicable === 0 ? 0 : Math.round((answered / applicable) * 100);
  const orderPosition = new Map(evaluation.orderedItemIds.map((id, index) => [id, index]));

  return (
    <>
      <div className="sticky top-0 z-10 border-b border-[hsl(var(--gm-border))] bg-[hsl(var(--gm-surface))]/95 px-4 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-[hsl(var(--gm-surface-muted))]"
            role="progressbar"
            aria-valuenow={percent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-[hsl(var(--gm-brand))] transition-all"
              style={{ width: `${percent}%` }}
            />
          </div>
          <span className="text-sm font-bold tabular-nums">
            {answered}/{applicable}
          </span>
          {evaluation.progress.overdue > 0 ? (
            <span className="gm-countdown-late">{evaluation.progress.overdue} sen</span>
          ) : null}
        </div>
      </div>

      <main className="gm-shell py-4">
        {template.sections.map((section) => {
          const sectionItems = template.items
            .filter((i) => i.sectionId === section.id)
            .sort(
              (a, b) =>
                (orderPosition.get(a.id) ?? 0) - (orderPosition.get(b.id) ?? 0),
            );
          if (sectionItems.length === 0) return null;

          return (
            <section key={section.id}>
              <div className="gm-section-header">
                <h2 className="gm-section-title">{section.titleSv}</h2>
                {section.windowStart ? (
                  <span className="gm-muted text-sm tabular-nums">
                    {section.windowStart}–{section.windowEnd}
                  </span>
                ) : null}
              </div>
              {section.noteSv ? <p className="gm-panel mb-3 text-sm">{section.noteSv}</p> : null}
              {section.assigneeSlot === 2 ? (
                <p className="gm-panel mb-3 text-sm">
                  {section.slotLabelSv ?? 'Genomförs av Person 2'}
                </p>
              ) : null}

              <ul className="space-y-3">
                {sectionItems.map((item) => (
                  <ItemCard
                    key={item.code}
                    item={item}
                    rules={mergedRules.get(item.code)!}
                    evaluation={evaluation.byItem[item.id]!}
                    state={items.find((i) => i.itemCode === item.code)}
                    ordinalLabel={item.ordinal}
                    disabled={signed}
                    onChange={(patch) => update(item.code, patch)}
                  />
                ))}
              </ul>
            </section>
          );
        })}

        {template.footerNotesSv ? (
          <p className="gm-panel mt-6 text-sm">{template.footerNotesSv}</p>
        ) : null}

        {signed ? (
          <div className="gm-card gm-card-pad mt-6 space-y-2">
            <p className="flex items-center gap-2 font-bold text-ja">
              <CheckCircle2 className="h-5 w-5" aria-hidden />
              Listan är signerad
            </p>
            {run.signatures.map((signature) => (
              <p key={signature.slot} className="gm-muted font-mono text-sm">
                {signature.displayName} ({signature.username}) ·{' '}
                {new Date(signature.signedAt).toLocaleString('sv-SE', {
                  timeZone: 'Europe/Stockholm',
                  dateStyle: 'short',
                  timeStyle: 'short',
                })}{' '}
                · {signature.signatureHash.slice(0, 4)}…{signature.signatureHash.slice(-3)}
              </p>
            ))}
          </div>
        ) : null}
      </main>

      {!signed ? (
        <div className="gm-actionbar">
          <div className="mx-auto flex w-full max-w-3xl items-center gap-3">
            <div className="min-w-0 flex-1">
              {signError ? (
                <p className="gm-error m-0" role="alert">
                  {signError}
                </p>
              ) : (
                <p className="gm-muted m-0 text-sm">
                  {evaluation.canSubmit
                    ? 'Alla punkter är besvarade.'
                    : `${applicable - answered} punkt(er) kvar.`}
                  {saving ? ' · Sparar…' : ''}
                </p>
              )}
            </div>
            <Button onClick={sign} disabled={!evaluation.canSubmit || !canSign || saving}>
              <ShieldCheck className="h-5 w-5" aria-hidden />
              Signera
            </Button>
          </div>
        </div>
      ) : null}
    </>
  );
}
