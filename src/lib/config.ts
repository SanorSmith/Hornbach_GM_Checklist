/**
 * How the app is running right now.
 *
 * `demo` exists because the site is deployed before the database is linked:
 * the four checklists run end to end against in-memory data so the flow can be
 * tried on a real handheld, and a banner says plainly that nothing is stored.
 * The moment DATABASE_URL is set, the Postgres repository takes over.
 */
export type RunMode = 'demo' | 'live';

export function runMode(): RunMode {
  return process.env.DATABASE_URL ? 'live' : 'demo';
}

export function isDemo(): boolean {
  return runMode() === 'demo';
}

export const STORE_TIME_ZONE = process.env.DEFAULT_TIMEZONE ?? 'Europe/Stockholm';
export const STORE_CODE = process.env.DEFAULT_STORE_CODE ?? 'HB-SE-GM';

/**
 * Secrets have dev fallbacks so `npm run dev` and CI work out of the box, but a
 * production deployment without real values is a security hole, not an
 * inconvenience — so it fails loudly instead.
 */
function requiredSecret(name: string, devFallback: string): string {
  const value = process.env[name];
  if (value && value.length > 0) return value;
  if (process.env.NODE_ENV === 'production' && runMode() === 'live') {
    throw new Error(`${name} must be set in production.`);
  }
  return devFallback;
}

export const sessionSecret = () =>
  requiredSecret('SESSION_SECRET', 'dev-only-session-secret-at-least-32-chars');
export const signaturePepper = () =>
  requiredSecret('SIGNATURE_PEPPER', 'dev-only-signature-pepper');
export const badgePepper = () => requiredSecret('BADGE_PEPPER', 'dev-only-badge-pepper');
