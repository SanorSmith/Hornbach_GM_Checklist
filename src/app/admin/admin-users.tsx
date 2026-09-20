'use client';

import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { AdminUser } from '@/lib/admin/users';
import { ROLES, type Role } from '@/lib/auth/types';
import { t } from '@/lib/i18n';

const ROLE_LABEL: Record<Role, string> = {
  WORKER: t('role.worker'),
  GROUP_LEADER: t('role.groupLeader'),
  ADMIN: t('role.admin'),
};

/** A PIN that has just been issued — held only in this component's state. */
interface IssuedPin {
  name: string;
  pin: string;
}

export function AdminUsers({
  initialUsers,
  currentUserId,
}: {
  initialUsers: AdminUser[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState<AdminUser[]>(initialUsers);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [roles, setRoles] = useState<Role[]>(['WORKER']);
  const [issued, setIssued] = useState<IssuedPin | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const byUsername = (a: AdminUser, b: AdminUser) => a.username.localeCompare(b.username, 'sv');

  async function call(url: string, init: RequestInit): Promise<Record<string, unknown> | null> {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(url, init);
      const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        setError(typeof body.error === 'string' ? body.error : 'Något gick fel.');
        return null;
      }
      return body;
    } catch {
      setError('Ingen kontakt med servern.');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function createUser() {
    const body = await call('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, displayName, roles }),
    });
    if (!body) return;

    const user = body.user as AdminUser;
    setUsers((prev) => [...prev, user].sort(byUsername));
    setIssued({ name: user.displayName, pin: String(body.pin) });
    setUsername('');
    setDisplayName('');
    setRoles(['WORKER']);
  }

  async function resetPin(user: AdminUser) {
    const body = await call(`/api/admin/users/${user.id}/pin`, { method: 'POST' });
    if (body) setIssued({ name: user.displayName, pin: String(body.pin) });
  }

  async function setActive(user: AdminUser, isActive: boolean) {
    const body = await call(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive }),
    });
    if (body) setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, isActive } : u)));
  }

  async function toggleRole(user: AdminUser, role: Role) {
    const next = user.roles.includes(role)
      ? user.roles.filter((r) => r !== role)
      : [...user.roles, role];
    // An account with no role can sign in and do nothing; the server rejects it
    // too, but there is no reason to send it.
    if (next.length === 0) return;

    const body = await call(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roles: next }),
    });
    if (body) setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, roles: next } : u)));
  }

  const canCreate =
    !busy && username.trim().length >= 2 && displayName.trim().length >= 2 && roles.length > 0;

  return (
    <div className="space-y-6">
      {issued && (
        <Card className="border-[hsl(var(--gm-brand))]">
          <CardBody>
            <CardTitle>{t('admin.pinTitle').replace('{name}', issued.name)}</CardTitle>
            <p className="my-2 font-mono text-3xl tracking-widest">{issued.pin}</p>
            <p className="gm-muted text-sm">{t('admin.pinOnce')}</p>
            <Button
              variant="secondary"
              size="compact"
              className="mt-3"
              onClick={() => setIssued(null)}
            >
              {t('admin.done')}
            </Button>
          </CardBody>
        </Card>
      )}

      {error && <p className="text-sm text-[hsl(var(--gm-danger))]">{error}</p>}

      <Card>
        <CardBody>
          <CardTitle>{t('admin.newUser')}</CardTitle>
          <div className="mt-3 space-y-3">
            <label className="block">
              <span className="gm-muted mb-1 block text-sm">{t('admin.username')}</span>
              <Input
                value={username}
                autoCapitalize="none"
                autoCorrect="off"
                onChange={(e) => setUsername(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="gm-muted mb-1 block text-sm">{t('admin.displayName')}</span>
              <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
            </label>

            <fieldset>
              <legend className="gm-muted mb-1 text-sm">{t('admin.roles')}</legend>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((role) => (
                  <Button
                    key={role}
                    variant={roles.includes(role) ? 'primary' : 'secondary'}
                    size="compact"
                    aria-pressed={roles.includes(role)}
                    onClick={() =>
                      setRoles((prev) =>
                        prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
                      )
                    }
                  >
                    {ROLE_LABEL[role]}
                  </Button>
                ))}
              </div>
            </fieldset>

            <Button size="block" disabled={!canCreate} onClick={() => void createUser()}>
              {busy ? t('admin.saving') : t('admin.create')}
            </Button>
          </div>
        </CardBody>
      </Card>

      <section>
        <h2 className="gm-section-title mb-3">{t('admin.users')}</h2>
        {users.length === 0 && <p className="gm-muted">{t('admin.noUsers')}</p>}

        <ul className="space-y-3">
          {users.map((user) => (
            <li key={user.id}>
              <Card>
                <CardBody>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="truncate">{user.displayName}</CardTitle>
                      <p className="gm-muted text-sm">{user.username}</p>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {user.isLocked && <Badge>{t('admin.locked')}</Badge>}
                      <Badge>{user.isActive ? t('admin.active') : t('admin.inactive')}</Badge>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {ROLES.map((role) => (
                      <Button
                        key={role}
                        variant={user.roles.includes(role) ? 'primary' : 'secondary'}
                        size="compact"
                        aria-pressed={user.roles.includes(role)}
                        disabled={busy}
                        onClick={() => void toggleRole(user, role)}
                      >
                        {ROLE_LABEL[role]}
                      </Button>
                    ))}
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="compact"
                      disabled={busy}
                      onClick={() => void resetPin(user)}
                    >
                      {t('admin.resetPin')}
                    </Button>

                    {/* Deactivating yourself is not recoverable from inside the
                        app, so the option is not offered for your own account. */}
                    {user.id !== currentUserId && (
                      <Button
                        variant={user.isActive ? 'danger' : 'secondary'}
                        size="compact"
                        disabled={busy}
                        onClick={() => void setActive(user, !user.isActive)}
                      >
                        {user.isActive ? t('admin.deactivate') : t('admin.activate')}
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
