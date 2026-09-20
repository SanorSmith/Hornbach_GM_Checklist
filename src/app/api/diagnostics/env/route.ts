import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * TEMPORARY. Reports which environment variables the running deployment can
 * see, so a misconfiguration can be diagnosed without Vercel dashboard access.
 *
 * Reports presence and length only — never a value. Remove once the deployment
 * is configured; it is not meant to live here.
 */
const EXPECTED = [
  'DATABASE_URL',
  'DIRECT_DATABASE_URL',
  'SESSION_SECRET',
  'SIGNATURE_PEPPER',
  'BADGE_PEPPER',
  'CRON_SECRET',
] as const;

export async function GET() {
  const seen: Record<string, { set: boolean; length: number }> = {};
  for (const name of EXPECTED) {
    const value = process.env[name];
    seen[name] = { set: Boolean(value && value.length > 0), length: value?.length ?? 0 };
  }

  return NextResponse.json({
    nodeEnv: process.env.NODE_ENV,
    runMode: process.env.DATABASE_URL ? 'live' : 'demo',
    vars: seen,
  });
}
