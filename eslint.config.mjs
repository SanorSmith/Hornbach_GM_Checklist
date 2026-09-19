import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';

/** @type {import('eslint').Linter.Config[]} */
const config = [
  { ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'scripts/out/**'] },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // One connection singleton, never a pool per route handler. Opening a
      // connection per serverless invocation exhausts the Supabase pooler.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'postgres',
              message:
                'Import the shared client from @/lib/db/client instead of creating a new connection.',
            },
          ],
        },
      ],
    },
  },
  {
    // The places that are allowed to construct a connection.
    files: ['src/lib/db/client.ts', 'drizzle.config.ts', 'scripts/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
];

export default config;
