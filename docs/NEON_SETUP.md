# Neon setup

The app talks to Neon Postgres. Run this once, from a machine with network
access to `neon.tech` — it cannot be done from a sandboxed CI or agent session.

Project: `falling-dream-54407610`, branch `production`.

## 1. Link the project

```bash
npm i -g neon@latest && neon login
neon skills -y
neon mcp -y
neon link --project-id falling-dream-54407610 --branch production -y
neon config init
neon deploy
```

`neon config init` writes `neon.ts`, which is already committed here and
declares the private `images` bucket used for checklist evidence photos. Keep
`access: "private"` — those photographs show the workplace and are personal
data; they must only ever be served through short-lived signed URLs.

## 2. Create the schema

Two ways. They are **not** interchangeable: the Drizzle path takes two steps,
the SQL editor path takes one.

**Drizzle (preferred — keeps migration history):**

```bash
cp .env.example .env.local     # fill in DATABASE_URL and DIRECT_DATABASE_URL
npm run db:migrate
```

`DIRECT_DATABASE_URL` is the same host with `-pooler` removed. Migrations need
DDL and advisory locks, which the pooled endpoint does not support.

Then apply [`db/sql/audit_chain.sql`](../db/sql/audit_chain.sql) — paste it into
the Neon SQL editor, or pipe it in with `psql`.

**This second step is not optional.** `db:migrate` applies only
`db/migrations/`, and the audit log's hash chain and append-only trigger are not
migrations. Skip it and nothing appears to be wrong: `audit_log` exists and
accepts writes, it is simply neither chained nor immutable, and
`scripts/verify-audit-chain.ts` would be checking a chain that nothing
maintains. The file replaces its own functions and triggers, so re-running it is
harmless.

**Neon SQL editor (no local toolchain needed):**

Paste the contents of [`db/sql/schema.sql`](../db/sql/schema.sql). It is
generated from the migrations *and* `audit_chain.sql`, so unlike the Drizzle
path it is complete on its own. Safe to re-run.

## 3. Seed the store and the first account

```bash
npm run seed            # the store and one admin account
```

Creates the store and a single `admin` user, and prints a randomly generated PIN
**once** — there are deliberately no default credentials. Put it in a password
manager: it is argon2-hashed, so a lost PIN means re-seeding, not recovery.

Add `-- --with-demo-users` for the `gpl` and `linefeeder` test accounts. Users
that already exist are left untouched, so the seed is safe to re-run.

The four checklist templates are not seeded. They live in `seeds/templates/` and
are served from code in both demo and database mode.

## 4. Vercel

Add to the Vercel project's environment variables (Settings → Environment
Variables), for Production and Preview:

| Variable | Value |
|---|---|
| `DATABASE_URL` | the pooled Neon connection string |
| `DIRECT_DATABASE_URL` | the direct (non-pooled) one |
| `SESSION_SECRET` | `openssl rand -base64 32` |
| `SIGNATURE_PEPPER` | `openssl rand -hex 32` |
| `BADGE_PEPPER` | `openssl rand -hex 32` |
| `CRON_SECRET` | `openssl rand -hex 32` |

Until `DATABASE_URL` is set the deployment runs in **demo mode** — the four
checklists work end to end against in-memory data, and a banner says so. That
is deliberate, so the site is usable before the database exists.

## Two things worth deciding early

**Region.** The current connection string points at `us-east-2` (Ohio). This
system stores Swedish employees' names, their performance on each checklist,
their signatures and photographs of their workplace — all personal data under
GDPR, and staff-performance data is the sensitive end of it. Hosting it outside
the EU is not automatically unlawful, but it needs a transfer mechanism and it
is exactly the kind of detail a works council or DPO will ask about. Neon
offers `eu-central-1`. Moving is trivial now, while the database is empty, and
painful once real signed checklists exist.

**Credential rotation.** Rotate the `neondb_owner` password in the Neon console
after setup, and any time a connection string has been pasted into a chat,
ticket or email. Connection strings carry the password in plain text.
