#!/usr/bin/env node
/**
 * Pushes the values in .env.vercel.local to the Vercel project as Production
 * environment variables, then triggers a redeploy so they take effect.
 *
 *   npx vercel login          # once, interactive
 *   node scripts/push-vercel-env.mjs
 *
 * Values are read from disk and sent straight to Vercel; none are printed. The
 * file is gitignored (.env.*.local) and is not needed after this runs.
 *
 * Existing variables of the same name are replaced, so re-running is safe —
 * useful after rotating the Neon password.
 */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ENV_FILE = '.env.vercel.local';
const PROJECT = 'hornbach-gm-checklist';

function token() {
  if (process.env.VERCEL_TOKEN) return process.env.VERCEL_TOKEN;
  for (const p of [
    join(homedir(), 'AppData', 'Roaming', 'xdg.data', 'com.vercel.cli', 'auth.json'),
    join(homedir(), 'AppData', 'Roaming', 'com.vercel.cli', 'auth.json'),
    join(homedir(), '.local', 'share', 'com.vercel.cli', 'auth.json'),
    join(homedir(), 'Library', 'Application Support', 'com.vercel.cli', 'auth.json'),
  ]) {
    try {
      const t = JSON.parse(readFileSync(p, 'utf8')).token;
      if (t) return t;
    } catch {
      // Try the next location.
    }
  }
  return null;
}

const TOKEN = token();
if (!TOKEN) {
  console.error('No Vercel token. Run `npx vercel login` first, or set VERCEL_TOKEN.');
  process.exit(1);
}

const pairs = readFileSync(ENV_FILE, 'utf8')
  .split('\n')
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const i = line.indexOf('=');
    return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, '')];
  })
  .filter(([k, v]) => k && v);

if (pairs.length === 0) {
  console.error(`${ENV_FILE} has no values.`);
  process.exit(1);
}

const api = async (path, init = {}) => {
  const res = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
};

// Gate on reaching the project, not on /v2/user: a project-scoped token can do
// everything needed here while being forbidden from reading the account.
let scope = null;
const direct = await api(`/v9/projects/${PROJECT}`);
if (direct.ok) {
  scope = { teamId: undefined, id: direct.body.id };
} else {
  const teams = await api('/v2/teams');
  for (const t of teams.body.teams ?? []) {
    const project = await api(`/v9/projects/${PROJECT}?teamId=${t.id}`);
    if (project.ok) {
      scope = { teamId: t.id, id: project.body.id };
      break;
    }
  }
}
if (!scope) {
  console.error(
    `Could not reach project "${PROJECT}" with this token. Check that it is scoped to the team that owns it.`,
  );
  process.exit(1);
}
console.log(`project: ${PROJECT} (${scope.id})`);

const q = scope.teamId ? `?teamId=${scope.teamId}&upsert=true` : '?upsert=true';
let failed = 0;
for (const [key, value] of pairs) {
  const res = await api(`/v10/projects/${scope.id}/env${q}`, {
    method: 'POST',
    body: JSON.stringify({ key, value, type: 'encrypted', target: ['production'] }),
  });
  if (res.ok) {
    console.log(`  set ${key}`);
  } else {
    failed += 1;
    console.error(`  FAILED ${key}: ${res.body.error?.message ?? res.status}`);
  }
}
if (failed > 0) process.exit(1);

// Variables only apply to a new build, so redeploy the current production commit.
const deploys = await api(
  `/v6/deployments?projectId=${scope.id}&target=production&limit=1${scope.teamId ? `&teamId=${scope.teamId}` : ''}`,
);
const latest = deploys.body.deployments?.[0];
if (!latest) {
  console.log('\nVariables set. No production deployment found to redeploy — push a commit.');
  process.exit(0);
}

const redeploy = await api(`/v13/deployments${scope.teamId ? `?teamId=${scope.teamId}` : ''}`, {
  method: 'POST',
  body: JSON.stringify({
    name: PROJECT,
    project: scope.id,
    target: 'production',
    deploymentId: latest.uid,
  }),
});

console.log(
  redeploy.ok
    ? `\nVariables set and redeploy started: https://${redeploy.body.url}`
    : `\nVariables set, but the redeploy call failed (${redeploy.status}). Redeploy from the dashboard.`,
);
