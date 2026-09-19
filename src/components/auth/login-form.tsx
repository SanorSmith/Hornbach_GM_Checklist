'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { t } from '@/lib/i18n';
import { PinDots, PinPad } from './pin-pad';

const PIN_MAX = 8;

export function LoginForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event?: React.FormEvent) => {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, pin }),
      });
      const body = await response.json().catch(() => null);

      if (response.ok && body?.ok) {
        router.replace(returnTo);
        router.refresh();
        return;
      }

      setPin('');
      switch (body?.reason) {
        case 'LOCKED': {
          const until = body.until ? new Date(body.until) : null;
          const minutes = until
            ? Math.max(1, Math.ceil((until.getTime() - Date.now()) / 60_000))
            : 15;
          setError(t('login.locked').replace('{minutes}', String(minutes)));
          break;
        }
        case 'INVALID_INPUT':
          setError(t('login.invalidInput'));
          break;
        case 'INACTIVE':
          setError(t('login.inactive'));
          break;
        case 'BAD_CREDENTIALS':
          setError(t('login.badCredentials'));
          break;
        default:
          setError(t('login.failed'));
      }
    } catch {
      setError(t('login.failed'));
    } finally {
      setBusy(false);
    }
  };

  const canSubmit = username.trim().length > 0 && pin.length >= 4 && !busy;

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="gm-label" htmlFor="username">
          {t('login.username')}
        </label>
        <Input
          id="username"
          name="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          enterKeyHint="next"
          disabled={busy}
          required
        />
      </div>

      <div>
        <span className="gm-label">{t('login.pin')}</span>
        <PinDots length={pin.length} max={PIN_MAX} />
        {/* Kept in the DOM for password managers and for a hardware keyboard,
            but visually replaced by the pad above. */}
        <input
          type="password"
          inputMode="numeric"
          autoComplete="current-password"
          className="gm-sr-only"
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, PIN_MAX))}
          aria-label={t('login.pin')}
        />
        <div className="mt-3">
          <PinPad value={pin} maxLength={PIN_MAX} onChange={setPin} disabled={busy} />
        </div>
      </div>

      {error ? (
        <p className="gm-error" role="alert" aria-live="assertive">
          {error}
        </p>
      ) : null}

      <Button type="submit" size="block" disabled={!canSubmit}>
        {busy ? t('login.signingIn') : t('login.submit')}
      </Button>
    </form>
  );
}
