#!/usr/bin/env node
/**
 * Prisma CLI wrapper that resolves the monorepo-root `.env`.
 *
 * WHY THIS EXISTS
 * ---------------
 * `DATABASE_URL` is defined once, in the repository-root `.env` (single source of
 * truth for the shared Aiven instance). The Prisma CLI only auto-loads `.env`
 * from its own working directory or the schema directory — and every `prisma:*`
 * script runs with the working directory set to `packages/api`. The result was
 * that `prisma generate | migrate | studio | validate` all failed locally with:
 *
 *   Error code: P1012
 *   error: Environment variable not found: DATABASE_URL.
 *
 * This wrapper loads the root `.env` first (then any package-local `.env` as an
 * override) and delegates every argument to the real Prisma CLI, matching the
 * loading order already used by `src/config/index.ts`.
 *
 * Usage (from packages/api): node scripts/prisma-env.cjs migrate dev
 */
const path = require('path');
const { spawnSync } = require('child_process');
const dotenv = require('dotenv');

// Root .env first (shared, authoritative), then a package-local .env if present.
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config();

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('prisma-env: expected a Prisma command, e.g. "generate" or "migrate dev".');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error(
    'prisma-env: DATABASE_URL is not set. Add it to the repository-root .env ' +
      '(see .env.example). Aiven requires the URL to end with ?sslmode=require.',
  );
  process.exit(1);
}

// `shell: true` is required on Windows so the `prisma.cmd` shim on PATH resolves.
// pnpm puts packages/api/node_modules/.bin on PATH when running package scripts.
const result = spawnSync('prisma', args, {
  stdio: 'inherit',
  shell: true,
  env: process.env,
});

if (result.error) {
  console.error(`prisma-env: failed to launch the Prisma CLI - ${result.error.message}`);
  process.exit(1);
}

process.exit(result.status ?? 1);
