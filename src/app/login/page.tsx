import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/auth/login-form';
import { Card, CardBody } from '@/components/ui/card';
import { currentSession } from '@/lib/auth/guard';
import { isDemo } from '@/lib/config';
import { t } from '@/lib/i18n';
import { DEMO_USERS } from '@/lib/repo';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const session = await currentSession();
  if (session) redirect('/');

  const params = await searchParams;
  // Only ever bounce back to a path on this site, never to an absolute URL an
  // attacker could put in the query string.
  const requested = params.returnTo ?? '/';
  const returnTo = requested.startsWith('/') && !requested.startsWith('//') ? requested : '/';

  return (
    <main className="gm-shell flex min-h-dvh max-w-md flex-col justify-center py-8">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-black tracking-tight">{t('app.name')}</h1>
        <p className="gm-muted mt-1 text-sm">{t('login.subtitle')}</p>
      </header>

      <Card>
        <CardBody>
          <LoginForm returnTo={returnTo} />
        </CardBody>
      </Card>

      {isDemo() ? (
        <section className="gm-panel mt-6 text-sm">
          <h2 className="mb-1 font-bold">{t('login.demoHeading')}</h2>
          <p className="gm-muted mb-3">{t('login.demoBody')}</p>
          <ul className="space-y-1 font-mono text-sm tabular-nums">
            {DEMO_USERS.map((user) => (
              <li key={user.username} className="flex justify-between gap-3">
                <span>{user.username}</span>
                <span className="gm-muted">{user.pin}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
