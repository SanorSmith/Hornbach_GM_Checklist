#!/usr/bin/env node
/**
 * Concatenates the drizzle migrations into a single db/sql/schema.sql that can
 * be pasted straight into the Neon SQL editor.
 *
 * This exists because the schema has to be creatable by someone who has a
 * browser and no local toolchain.
 *
 * Everything comes from db/migrations. Hand-written SQL used to be appended
 * from db/sql/ as well, which quietly made this file and `npm run db:migrate`
 * produce different databases — the audit chain existed only here. Anything the
 * schema needs belongs in a migration.
 */
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const MIGRATIONS = 'db/migrations';
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

mkdirSync('db/sql', { recursive: true });
writeFileSync(OUT, parts.join('\n'));
console.log(`Wrote ${OUT} from ${migrations.length} migration(s).`);
