#!/usr/bin/env node
/**
 * Concatenates the drizzle migrations plus the hand-written SQL into a single
 * db/sql/schema.sql that can be pasted straight into the Neon SQL editor.
 *
 * This exists because the schema has to be creatable by someone who has a
 * browser and no local toolchain.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = 'db/migrations';
const EXTRA = ['db/sql/audit_chain.sql'];
const OUT = 'db/sql/schema.sql';

const migrations = readdirSync(MIGRATIONS)
  .filter((f) => f.endsWith('.sql'))
  .sort();

const parts = [
  '-- GENERATED FILE — do not edit by hand.',
  '-- Rebuild with: npm run db:schema-sql',
  '--',
  '-- Full schema for the Hornbach GM Checklist database.',
  '-- Paste into the Neon SQL editor, or prefer `npm run db:migrate`, which',
  '-- keeps migration history.',
  '',
];

for (const file of migrations) {
  parts.push(`-- ===== ${MIGRATIONS}/${file} =====`);
  // drizzle uses this marker to split statements; plain SQL clients do not.
  parts.push(readFileSync(join(MIGRATIONS, file), 'utf8').replaceAll('--> statement-breakpoint', ''));
  parts.push('');
}

for (const file of EXTRA) {
  parts.push(`-- ===== ${file} =====`);
  parts.push(readFileSync(file, 'utf8'));
  parts.push('');
}

mkdirSync('db/sql', { recursive: true });
writeFileSync(OUT, parts.join('\n'));
console.log(`Wrote ${OUT} from ${migrations.length} migration(s) + ${EXTRA.length} extra file(s).`);
