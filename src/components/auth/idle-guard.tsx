'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

/**
 * Signs the user out after a period of inactivity, and actually does it.
 *
 * On a shared Zebra this matters: the device is handed between shifts, and a
 * checklist signed under the previous person's login is a worthless record.
 * Shared devices therefore get three minutes; a personal phone or desktop gets
 * thirty.
 *
 * Nothing in progress is lost — answers are saved as they are given, so the
 * next person signs in and the previous run is still there, attributed
 * correctly.
 */
const SHARED_IDLE_MS = 3 * 60_000;
const PERSONAL_IDLE_MS = 30 * 60_000;
const WARNING_MS = 30_000;
const CHANNEL = 'gm-activity';

export function IdleGuard({ shared = true }: { shared?: boolean }) {
  const router = useRouter();
  const idleMs = shared ? SHARED_IDLE_MS : PERSONAL_IDLE_MS;

  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  // Seeded on mount, not during render: reading the clock while rendering is
  // impure and React may render more than once.
  const lastActivity = useRef(0);
  const channel = useRef<BroadcastChannel | null>(null);

  const signOut = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  }, [router]);

  const markActive = useCallback(() => {
    lastActivity.current = Date.now();
    setSecondsLeft(null);
  }, []);

  useEffect(() => {
    lastActivity.current = Date.now();

    // Activity in one tab keeps the others alive too.
    if (typeof BroadcastChannel !== 'undefined') {
      channel.current = new BroadcastChannel(CHANNEL);
      channel.current.onmessage = () => {
        lastActivity.current = Date.now();
        setSecondsLeft(null);
      };
    }
    return () => channel.current?.close();
  }, []);

  useEffect(() => {
    const onActivity = () => {
      markActive();
      channel.current?.postMessage('active');
    };

    const events: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'wheel'];
    for (const event of events) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    document.addEventListener('visibilitychange', onActivity);

    const timer = window.setInterval(() => {
      const idleFor = Date.now() - lastActivity.current;
      const remaining = idleMs - idleFor;

      if (remaining <= 0) {
        void signOut();
        return;
      }
      setSecondsLeft(remaining <= WARNING_MS ? Math.ceil(remaining / 1000) : null);
    }, 1000);

    return () => {
      for (const event of events) window.removeEventListener(event, onActivity);
      document.removeEventListener('visibilitychange', onActivity);
      window.clearInterval(timer);
    };
  }, [idleMs, markActive, signOut]);

  if (secondsLeft === null) return null;

  return (
    <div
      role="alertdialog"
      aria-live="assertive"
      className="fixed inset-x-0 bottom-0 z-40 border-t-4 border-due-soon bg-[hsl(var(--gm-surface))] p-4 shadow-lg"
    >
      <div className="gm-shell flex items-center justify-between gap-4">
        <div>
          <p className="font-bold">{t('idle.warningTitle')}</p>
          <p className="gm-muted text-sm tabular-nums">
            {t('idle.warningBody').replace('{seconds}', String(secondsLeft))}
          </p>
        </div>
        <Button onClick={markActive}>{t('idle.stay')}</Button>
      </div>
    </div>
  );
}
