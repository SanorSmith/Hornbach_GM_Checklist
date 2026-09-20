'use client';

import { useEffect, useState } from 'react';
import { Bell, BellOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

type State = 'checking' | 'unsupported' | 'denied' | 'off' | 'on' | 'working';

/**
 * VAPID keys travel as base64url; PushManager wants the raw bytes.
 *
 * Built over an explicit ArrayBuffer because `applicationServerKey` will not
 * accept a view that might be backed by a SharedArrayBuffer.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(normalised);
  const output = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

/**
 * Turns push notifications on for this device.
 *
 * Per device rather than per person on purpose: permission is granted by a
 * browser, and a warehouse handheld shared between shifts should not keep
 * notifying the person who set it up last week.
 *
 * Nothing here is required for the app to work. If the browser refuses, or the
 * keys are not configured, the in-app banner still shows everything — push only
 * makes it timely.
 */
export function PushToggle({ vapidPublicKey }: { vapidPublicKey: string }) {
  const [state, setState] = useState<State>('checking');
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Resolved first, then set once. Setting state as the effect runs makes the
    // first render's output depend on how far this got, which React's rules
    // rightly object to.
    async function detect(): Promise<State> {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) return 'unsupported';
      if (Notification.permission === 'denied') return 'denied';
      try {
        const registration = await navigator.serviceWorker.getRegistration();
        const subscription = await registration?.pushManager.getSubscription();
        return subscription ? 'on' : 'off';
      } catch {
        return 'off';
      }
    }

    void detect().then((next) => {
      if (!cancelled) setState(next);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setState('working');
    setError(null);
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState(permission === 'denied' ? 'denied' : 'off');
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        // Required: a push without a payload cannot say which list is late.
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      });

      const response = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription.toJSON()),
      });
      if (!response.ok) {
        setError(t('push.failed'));
        setState('off');
        return;
      }
      setState('on');
    } catch {
      setError(t('push.failed'));
      setState('off');
    }
  }

  async function sendTest() {
    setError(null);
    setNote(null);
    try {
      const response = await fetch('/api/push/test', { method: 'POST' });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
        sent?: number;
      };
      if (!response.ok) {
        setError(body.error ?? t('push.failed'));
        return;
      }
      setNote(t('push.testSent').replace('{count}', String(body.sent ?? 0)));
    } catch {
      setError(t('push.failed'));
    }
  }

  async function disable() {
    setState('working');
    try {
      const registration = await navigator.serviceWorker.getRegistration();
      const subscription = await registration?.pushManager.getSubscription();
      if (subscription) {
        await fetch('/api/push/subscribe', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
        await subscription.unsubscribe();
      }
      setState('off');
    } catch {
      setState('on');
    }
  }

  if (state === 'checking') return null;

  if (state === 'unsupported' || state === 'denied') {
    return (
      <p className="gm-muted flex items-center gap-2 text-sm">
        <BellOff className="h-4 w-4" aria-hidden />
        {t(state === 'denied' ? 'push.denied' : 'push.unsupported')}
      </p>
    );
  }

  return (
    <div>
      <Button
        variant={state === 'on' ? 'secondary' : 'primary'}
        size="compact"
        disabled={state === 'working'}
        onClick={() => void (state === 'on' ? disable() : enable())}
      >
        {state === 'on' ? (
          <BellOff className="h-4 w-4" aria-hidden />
        ) : (
          <Bell className="h-4 w-4" aria-hidden />
        )}
        {state === 'working'
          ? t('push.working')
          : t(state === 'on' ? 'push.turnOff' : 'push.enable')}
      </Button>
      {/* Only once it is on: confirming delivery is the question every new
          handheld raises, and waiting for a list to go late is a poor answer. */}
      {state === 'on' && (
        <Button
          variant="ghost"
          size="compact"
          className="ml-2"
          onClick={() => void sendTest()}
        >
          {t('push.test')}
        </Button>
      )}

      {note && <p className="gm-muted mt-1 text-sm">{note}</p>}
      {error && <p className="mt-1 text-sm text-[hsl(var(--gm-danger))]">{error}</p>}
    </div>
  );
}
