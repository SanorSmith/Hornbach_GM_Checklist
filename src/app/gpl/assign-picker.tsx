'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { t } from '@/lib/i18n';

export interface AssignableUser {
  id: string;
  displayName: string;
}

/**
 * Assigns a checklist to someone for today.
 *
 * A plain select rather than a modal: a group leader does this four times at
 * the start of a shift, on a phone, and every extra tap is one they make again
 * tomorrow. Choosing "nobody" clears the assignment rather than deleting the
 * list, because an unassigned checklist is still a checklist that has to be done.
 */
export function AssignPicker({
  templateCode,
  users,
  current,
}: {
  templateCode: string;
  users: AssignableUser[];
  current: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(assignedTo: string) {
    setBusy(true);
    setError(null);
    try {
      const clearing = assignedTo === '';
      const response = await fetch('/api/assignments', {
        method: clearing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          clearing ? { templateCode, slot: 1 } : { templateCode, slot: 1, assignedTo },
        ),
      });
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setError(body.error ?? 'Kunde inte spara.');
        return;
      }
      router.refresh();
    } catch {
      setError('Ingen kontakt med servern.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3">
      <label className="block">
        <span className="gm-muted mb-1 block text-sm">{t('assign.label')}</span>
        <select
          className="min-h-touch w-full rounded-gm border border-[hsl(var(--gm-border))] bg-[hsl(var(--gm-surface))] px-3 text-base"
          value={current ?? ''}
          disabled={busy}
          onChange={(e) => void change(e.target.value)}
        >
          <option value="">{busy ? t('assign.saving') : t('assign.nobody')}</option>
          {users.map((user) => (
            <option key={user.id} value={user.id}>
              {user.displayName}
            </option>
          ))}
        </select>
      </label>
      {error && <p className="mt-1 text-sm text-[hsl(var(--gm-danger))]">{error}</p>}
    </div>
  );
}
