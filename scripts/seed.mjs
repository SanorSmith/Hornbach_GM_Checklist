#!/usr/bin/env node
/**
 * Creates the store and the initial accounts on a fresh database.
 *
 * PINs are generated randomly and printed ONCE. There are deliberately no
 * default credentials: a known PIN that ships with the software is a back door
 * into every deployment that forgets to change it.
 *
 *   npm run seed                      # store + one admin
 *   npm run seed -- --with-demo-users # plus a worker and a group leader
 */
import { randomInt, randomUUID } from 'node:crypto';
import { hash } from '@node-rs/argon2';
import postgres from 'postgres';
import { config } from 'dotenv';

config({ path: '.env.local' });

const url = process.env.DIRECT_DATABASE_URL || process.env.DATABASE_URL;
if (!url) {
  console.error('Set DATABASE_URL (or DIRECT_DATABASE_URL) before seeding.');
  process.exit(1);
}

const STORE_CODE = process.env.DEFAULT_STORE_CODE ?? 'HB-SE-GM';
const TIMEZONE = process.env.DEFAULT_TIMEZONE ?? 'Europe/Stockholm';
const withDemoUsers = process.argv.includes('--with-demo-users');

const ARGON2ID = 2;
const argonOptions = { algorithm: ARGON2ID, memoryCost: 19456, timeCost: 2, parallelism: 1 };

/** Six digits from a CSPRNG, not Math.random. */
const newPin = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

const sql = postgres(url, { max: 1, prepare: false, onnotice: () => {} });

const accounts = [
  { username: 'admin', displayName: 'Administratör', roles: ['WORKER', 'GROUP_LEADER', 'ADMIN'] },
  ...(withDemoUsers
    ? [
        { username: 'gpl', displayName: 'Gruppledare GM', roles: ['WORKER', 'GROUP_LEADER'] },
        { username: 'linefeeder', displayName: 'Linefeeder GM', roles: ['WORKER'] },
      ]
    : []),
];

try {
  const [store] = await sql`
    INSERT INTO stores (id, code, name, timezone, locale)
    VALUES (${randomUUID()}, ${STORE_CODE}, ${'Hornbach GM'}, ${TIMEZONE}, ${'sv-SE'})
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id, code
  `;
  console.log(`Store ${store.code} ready.`);

  const created = [];

  for (const account of accounts) {
    const existing = await sql`
      SELECT id FROM users WHERE store_id = ${store.id} AND username = ${account.username}
    `;
    if (existing.length > 0) {
      console.log(`User "${account.username}" already exists — left untouched.`);
      continue;
    }

    const pin = newPin();
    const [user] = await sql`
      INSERT INTO users (id, store_id, username, display_name, pin_hash)
      VALUES (${randomUUID()}, ${store.id}, ${account.username}, ${account.displayName},
              ${await hash(pin, argonOptions)})
      RETURNING id
    `;

    for (const role of account.roles) {
      await sql`
        INSERT INTO user_role_grants (user_id, role) VALUES (${user.id}, ${role})
        ON CONFLICT DO NOTHING
      `;
    }

    created.push({ username: account.username, pin });
  }

  if (created.length > 0) {
    console.log('\n  Generated PINs — shown once, store them in a password manager:\n');
    for (const { username, pin } of created) {
      console.log(`    ${username.padEnd(12)} ${pin}`);
    }
    console.log('\n  Change them on first sign-in.\n');
  }
} finally {
  await sql.end();
}
