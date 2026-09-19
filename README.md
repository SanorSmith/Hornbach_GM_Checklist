# Hornbach GM Checklist

Digital replacement for the paper checklists used by **GM (Godsmottagning)** —
goods reception — at Hornbach. Staff pick their list, are walked through it in
the correct time-and-rule order, attach the photo evidence the routine already
demands, and sign it with their login identity. The group leader after-controls
every point with a check and a comment, and gets weekly, monthly and yearly
reports per person and per list.

## The four lists

Decoded from the originals archived in [`docs/source-checklists/`](docs/source-checklists/).

| Code | List | Role | Answers | Points | Deadlines |
|---|---|---|---|---|---|
| `GM_LF_MORGON` | Checklista GM Linefeeder MORGON | Linefeeder, morgonpass | JA / NEJ / Inget behov | 18 | 07:00–15:00 |
| `GM_DORR` | Checklista för GM-personal vid dörren | Personal vid dörren | JA / NEJ / Inget behov | 14 | Hela dagen |
| `GM_GPL` | Checklista GPL GM | Gruppledare | JA / NEJ | 23 | 08:00–17:00 |
| `GM_LF_KVALL` | Checklista GM Linefeeder KVÄLL | Linefeeder, kvällspass | JA / NEJ / Inget behov | 20 | 17:00–19:45 |

The paper already encodes the logic the app enforces: hard clock deadlines
(`senast kl 08:30`), weekday/weekend variants (`19:00 eller 17:00 på helgerna`),
mandatory photo evidence (`OBS! Alltid Skicka bild`), conditional points
(`ENDAST OM 6-7 Stuv FINNS`), numeric fields (`Antal Stuva`), coded answers
(`Skriv F … eller B`), a banned excuse (`Skriv ej "hinner inte"`), and the
`Kontrollfält I / II / III` blocks that are the supervisor's after-control
groups.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript (strict) · Tailwind 3 ·
Drizzle ORM on Supabase Postgres (`eu-north-1`, Stockholm) · Supabase Storage
for photos · Vitest. Deployed on Vercel.

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

| Command | Does |
|---|---|
| `npm run verify` | typecheck + lint + test — the same gate CI runs |
| `npm run build` | production build |
| `npm run db:generate` | generate a migration from schema changes |
| `npm run db:migrate` | apply migrations (uses `DIRECT_DATABASE_URL`) |

## Devices, and an honest limit on alarms

Workers use **Zebra Android handhelds in the browser**, with no app installs
permitted. That constraint has a consequence worth stating plainly, so nobody
promises otherwise later:

> **A guaranteed loud alarm on a sleeping, offline device is not achievable from
> a browser.** No web API can schedule one.

What the app does instead, strongest first:

1. **In-app alarm — fully reliable, and the mechanism that does the work.**
   While a run is open the page holds a screen wake lock, shows a live countdown
   per point, and at the deadline takes over the screen with a full-screen
   panel, a looping tone and vibration, dismissible only by acting on the point.
   No network, no OS permission, no install.
2. **Web push** when the app is backgrounded — needs network at fire time and
   cannot ring at alarm volume. A nudge, not a guarantee.
3. **Escalation to the group leader**, whose own devices can install a PWA and
   receive reliable push. This mirrors how the paper routine already escalates.

Two optional upgrades, neither required: permitting *Add to Home screen* (a
WebAPK, not a sideloaded APK) makes layer 2 markedly more reliable; an
EMM-distributed signed APK would unlock true exact alarms. The notification
layer is written behind a seam so either can be added without a rewrite.

**iOS** cannot provide any of this: no scheduled local notifications from web
code, push only for a home-screen PWA on 16.4+ at Apple's discretion, and no
exact-alarm equivalent even natively. Treat any iPhone or iPad as a
supervisor/read-only device.

## Personal data

The app stores, for employees: username, display name, the answers and notes
they record, photographs of the workplace they take as evidence, signature
records (name, username, timestamp, device) and device identifiers. All of it
lives in the EU (Supabase `eu-north-1`); photographs are served only through
short-lived signed URLs and never publicly. GPS metadata is stripped from
photos at capture. Retention is proposed at 24 months pending confirmation with
Hornbach.

The `audit_log` is append-only and hash-chained, and signatures embed an
immutable snapshot of the run as signed — so a completed checklist is more
tamper-evident than the paper it replaces.

## Status

Phase 0 (foundation) is in place: project scaffold, design system, database
layer and CI. Phases follow in order — identity and auth, the rules engine and
first usable run, photo evidence, supervisor after-control, then offline sync,
alarms, reports and the template builder.
