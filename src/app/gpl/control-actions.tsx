'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import type { ControlStatus } from '@/lib/repo/types';

type Verdict = Exclude<ControlStatus, 'PENDING'>;

const VERDICTS: { value: Verdict; label: string; variant: 'primary' | 'secondary' | 'danger' }[] = [
  { value: 'OK', label: t('control.ok'), variant: 'primary' },
  { value: 'NOT_OK', label: t('control.notOk'), variant: 'danger' },
  { value: 'FOLLOW_UP', label: t('control.followUp'), variant: 'secondary' },
];

/**
 * The group leader's verdict on a finished list.
 *
 * A note is required for anything other than "approved": a deviation without a
 * reason tells the next shift nothing, which is the failure the paper form's
 * "skriv varför" was already trying to prevent. The server enforces it too.
 */
export function ControlActions({ runId }: { runId: string }) {
  const router = useRouter();
  const [chosen, setChosen] = useState<Verdict | null>(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const needsNote = chosen !== null && chosen !== 'OK';

  async function submit(status: Verdict) {
    if (status !== 'OK' && note.trim().length === 0) {
      setChosen(status);
      setError(t('control.noteRequired'));
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/runs/${runId}/control`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, note: note.trim() || undefined }),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? 'Kunde inte spara.');
        return;
      }
      // Re-render the page from the server so the verdict, the reviewer's name
      // and the counts above all move together.
      router.refresh();
    } catch {
      setError('Ingen kontakt med servern.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 border-t border-[hsl(var(--gm-border))] pt-3">
      <p className="mb-2 text-sm font-semibold">{t('control.title')}</p>

      {needsNote && (
        <label className="mb-2 block">
          <span className="sr-only">{t('control.notePlaceholder')}</span>
          <textarea
            className="w-full rounded-gm border border-[hsl(var(--gm-border))] bg-[hsl(var(--gm-surface))] p-2 text-sm"
            rows={2}
            value={note}
            placeholder={t('control.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        {VERDICTS.map((verdict) => (
          <Button
            key={verdict.value}
            variant={chosen === verdict.value ? verdict.variant : 'secondary'}
            size="compact"
            disabled={busy}
            onClick={() => void submit(verdict.value)}
          >
            {busy && chosen === verdict.value ? t('control.saving') : verdict.label}
          </Button>
        ))}
      </div>

      {error && <p className="mt-2 text-sm text-[hsl(var(--gm-danger))]">{error}</p>}
    </div>
  );
}
