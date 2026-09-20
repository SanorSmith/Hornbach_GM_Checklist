#!/usr/bin/env node
/**
 * Creates staff accounts in bulk through the running app's admin API.
 *
 *   node scripts/create-users.mjs [--url https://…] [--dry-run]
 *
 * Reads staff.local.txt, one person per line:
 *
 *   username, Display Name, ROLE[, ROLE...]
 *
 *   anna.lindqvist,  Anna Lindqvist,   WORKER
 *   erik.andersson,  Erik Andersson,   WORKER, GROUP_LEADER
 *
 * Roles: WORKER, GROUP_LEADER, ADMIN. Lines starting with # are ignored.
 *
 * Goes through the same API the admin screen uses, so the same rules apply:
 * generated PINs, audit entries, no duplicate usernames. Each PIN is shown once
 * and written to staff-pins.local.txt — both files are gitignored.
 *
 * Needs the admin PIN, from ADMIN_PIN or typed at the prompt.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';

const LIST = 'staff.local.txt';
const PINS_OUT = 'staff-pins.local.txt';
const DEFAULT_URL = 'https://hornbach-gm-checklist.vercel.app';

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const urlArg = args.indexOf('--url');
const BASE = (urlArg >= 0 ? args[urlArg + 1] : DEFAULT_URL).replace(/\/$/, '');
const ROLES = new Set(['WORKER', 'GROUP_LEADER', 'ADMIN']);

if (!existsSync(LIST)) {
  console.error(`No ${LIST}. Create it with one person per line:\n  username, Display Name, WORKER`);
  process.exit(1);
}

const people = [];
const problems = [];
readFileSync(LIST, 'utf8')
  .split('\n')
  .map((l, i) => [l.trim(), i + 1])
  .filter(([l]) => l && !l.startsWith('#'))
  .forEach(([line, lineNo]) => {
    const parts = line.split(',').map((p) => p.trim()).filter(Boolean);
    const [username, displayName, ...roles] = parts;
    if (!username || !displayName || roles.length === 0) {
      problems.push(`line ${lineNo}: need "username, Display Name, ROLE"`);
      return;
    }
    const upper = roles.map((r) => r.toUpperCase());
    const bad = upper.filter((r) => !ROLES.has(r));
    if (bad.length > 0) {
      problems.push(`line ${lineNo}: unknown role(s) ${bad.join(', ')}`);
      return;
    }
    people.push({ username: username.toLowerCase(), displayName, roles: upper });
  });

// Validate everything before creating anyone: a half-applied staff list is
// worse than none, because the PINs for the half that worked are already spent.
const seen = new Set();
for (const p of people) {
  if (seen.has(p.username)) problems.push(`duplicate username in the file: ${p.username}`);
  seen.add(p.username);
}
if (problems.length > 0) {
  console.error('Fix these first:');
  for (const p of problems) console.error(`  ${p}`);
  process.exit(1);
}
if (people.length === 0) {
  console.error(`${LIST} has no people in it.`);
  process.exit(1);
}

console.log(`${BASE}\n${people.length} account(s) to create:`);
for (const p of people) console.log(`  ${p.username.padEnd(20)} ${p.displayName.padEnd(24)} ${p.roles.join(', ')}`);
if (dryRun) {
  console.log('\n--dry-run: nothing was created.');
  process.exit(0);
}

let adminPin = process.env.ADMIN_PIN;
if (!adminPin) {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  adminPin = (await rl.question('\nAdmin PIN: ')).trim();
  rl.close();
}

const login = await fetch(`${BASE}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: 'admin', pin: adminPin }),
});
if (!login.ok) {
  console.error(`\nSign-in failed (${login.status}). Wrong PIN, or the account is locked.`);
  process.exit(1);
}
const cookie = (login.headers.getSetCookie?.() ?? []).map((c) => c.split(';')[0]).join('; ');
if (!cookie) {
  console.error('\nSigned in but no session cookie came back.');
  process.exit(1);
}

const created = [];
const failed = [];
for (const person of people) {
  const res = await fetch(`${BASE}/api/admin/users`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(person),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok) {
    created.push({ ...person, pin: body.pin });
    console.log(`  created ${person.username}`);
  } else {
    failed.push({ ...person, error: body.error ?? res.status });
    console.error(`  FAILED  ${person.username}: ${body.error ?? res.status}`);
  }
}

if (created.length > 0) {
  const lines = [
    `# PINs issued ${new Date().toISOString()} — shown once, argon2-hashed in the database.`,
    '# Hand each person their PIN, then delete this file.',
    '',
    ...created.map((c) => `${c.username.padEnd(20)} ${c.pin}   (${c.displayName})`),
    '',
  ];
  writeFileSync(PINS_OUT, lines.join('\n'));
  console.log(`\n${created.length} created. PINs written to ${PINS_OUT} — hand them out, then delete it.`);
}
if (failed.length > 0) {
  console.error(`${failed.length} failed. Fix and re-run; accounts that already exist are rejected, not duplicated.`);
  process.exit(1);
}
