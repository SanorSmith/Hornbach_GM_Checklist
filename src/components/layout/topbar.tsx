'use client';

import { ClipboardList, LogOut, Settings } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';
import { isLeader, type Role } from '@/lib/auth/types';

const ROLE_LABEL: Record<Role, string> = {
  WORKER: t('role.worker'),
  GROUP_LEADER: t('role.groupLeader'),
  ADMIN: t('role.admin'),
};

/** Highest-privilege role, which is the one worth showing. */
function primaryRole(roles: Role[]): Role {
  if (roles.includes('ADMIN')) return 'ADMIN';
  if (roles.includes('GROUP_LEADER')) return 'GROUP_LEADER';
  return 'WORKER';
}

export function Topbar({ displayName, username, roles }: {
  displayName: string;
  username: string;
  roles: Role[];
}) {
  const router = useRouter();

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
  };

  return (
    <header className="border-b border-[hsl(var(--gm-border))] bg-[hsl(var(--gm-surface))]">
      <div className="gm-shell flex items-center justify-between gap-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight">{displayName}</p>
          <p className="gm-muted truncate text-xs leading-tight">
            {username} · {ROLE_LABEL[primaryRole(roles)]}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {/* Without this the admin screen exists but is unreachable except by
              typing the URL. */}
          {isLeader(roles) && (
            <Link href="/gpl" className="focus-visible:rounded-gm">
              <Button variant="ghost" size="compact" aria-label={t('nav.leader')}>
                <ClipboardList className="h-4 w-4" aria-hidden />
                <span className="hidden xs:inline">{t('nav.leader')}</span>
              </Button>
            </Link>
          )}
          {roles.includes('ADMIN') && (
            <Link href="/admin" className="focus-visible:rounded-gm">
              <Button variant="ghost" size="compact" aria-label={t('nav.admin')}>
                <Settings className="h-4 w-4" aria-hidden />
                <span className="hidden xs:inline">{t('nav.admin')}</span>
              </Button>
            </Link>
          )}
          <Button variant="ghost" size="compact" onClick={signOut} aria-label={t('nav.logout')}>
            <LogOut className="h-4 w-4" aria-hidden />
            <span className="hidden xs:inline">{t('nav.logout')}</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
