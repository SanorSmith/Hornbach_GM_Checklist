import { redirect } from 'next/navigation';
import { DemoBanner } from '@/components/layout/demo-banner';
import { Topbar } from '@/components/layout/topbar';
import { requireUserOrRedirect } from '@/lib/auth/guard';
import { listAdminUsers } from '@/lib/admin/users';
import { t } from '@/lib/i18n';
import { AdminUsers } from './admin-users';

export const dynamic = 'force-dynamic';

/**
 * User administration: the only way to create the staff accounts that sign
 * checklists. `npm run seed` issues the first admin; everyone else is made here.
 */
export default async function AdminPage() {
  const session = await requireUserOrRedirect('/admin');
  if (!session.roles.includes('ADMIN')) redirect('/');

  const users = await listAdminUsers();

  return (
    <>
      <DemoBanner />
      <Topbar
        displayName={session.displayName}
        username={session.username}
        roles={session.roles}
      />
      <main className="gm-shell py-6">
        <h1 className="gm-section-title mb-4">{t('admin.title')}</h1>
        <AdminUsers initialUsers={users} currentUserId={session.userId} />
      </main>
    </>
  );
}
