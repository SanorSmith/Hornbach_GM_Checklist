'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import type { NotificationRecord } from '@/lib/repo/types';

function describe(item: NotificationRecord): string {
  const list = item.payload?.listName ?? item.templateCode;
  const key = item.kind === 'NOT_SIGNED_BY_END' ? 'notif.notSigned' : 'notif.notStarted';
  return t(key).replace('{list}', list);
}

/**
 * What the scheduled check found, shown to the person who can do something
 * about it.
 *
 * Dismissing acknowledges rather than deletes: the row stays, so it is still
 * possible to ask later who was told what, and when.
 */
export function NotificationBanner({ items }: { items: NotificationRecord[] }) {
  const router = useRouter();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const visible = items.filter((i) => !dismissed.has(i.id));
  if (visible.length === 0) return null;

  async function dismiss(id: string) {
    setBusy(true);
    // Hidden immediately: the worker tapped it, and waiting on a round trip to
    // acknowledge something they have already read helps nobody.
    setDismissed((prev) => new Set(prev).add(id));
    try {
      await fetch(`/api/notifications/${id}/ack`, { method: 'POST' });
      router.refresh();
    } catch {
      // Left dismissed locally; the next scheduled run will raise it again if
      // the list is still late, which is the behaviour we want anyway.
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="gm-shell pt-4" aria-live="polite">
      <div className="rounded-gm border border-[hsl(var(--gm-danger))] bg-[hsl(var(--gm-surface))] p-3">
        <p className="mb-2 flex items-center gap-2 text-sm font-bold">
          <AlertTriangle className="h-4 w-4" aria-hidden />
          {t('notif.title')}
        </p>

        <ul className="space-y-2">
          {visible.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold">{describe(item)}</p>
                {item.payload?.assigneeName && (
                  <p className="gm-muted text-xs">
                    {t('notif.assignee').replace('{name}', item.payload.assigneeName)}
                  </p>
                )}
              </div>
              <Button
                variant="ghost"
                size="compact"
                disabled={busy}
                onClick={() => void dismiss(item.id)}
              >
                {t('notif.dismiss')}
              </Button>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
