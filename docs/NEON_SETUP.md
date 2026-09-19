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

Two ways, same result. Use whichever you have to hand.

**Drizzle (preferred — keeps migration history):**

```bash
cp .env.example .env.local     # fill in DATABASE_URL and DIRECT_DATABASE_URL
npm run db:migrate
```

`DIRECT_DATABASE_URL` is the same host with `-pooler` removed. Migrations need
DDL and advisory locks, which the pooled endpoint does not support.

**Neon SQL editor (no local toolchain needed):**

Paste the contents of [`db/sql/schema.sql`](../db/sql/schema.sql). It is
generated from the same migrations and is safe to re-run.

## 3. Seed the store and the checklists

```bash
npm run seed            # store, roles, and the four checklist templates
```

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
