# AfriConnect Professionals

> Premium, invitation-style curated dating platform for highly educated African
> professionals. MVP build — modular monolith, microservices-ready.

This repository is governed by [`AGENTS.md`](./AGENTS.md). That document is law:
every module boundary, error type, and schema rule in it is enforced here.

## Stack

- **Backend:** Node.js + TypeScript + Express + Prisma (PostgreSQL)
- **Shared:** `packages/shared` — errors, logger, constants, types, Zod schemas
- **Frontend (scaffold):** Next.js 14 (App Router) at `apps/web`
- **Monorepo:** pnpm workspaces + Turborepo

## Architecture (Clauses 1–8 of AGENTS.md)

```
apps/web                 → Next.js member portal + landing
packages/api             → Express API (modules/*, prisma, shared config)
packages/shared          → Cross-cutting code (errors, logger, constants, crypto, types)
```

Every module under `packages/api/src/modules/<name>/` strictly follows the 7-file
contract:

```
<name>.controller.ts
<name>.service.ts
<name>.repository.ts
<name>.routes.ts
<name>.schema.ts      (Zod validation)
<name>.types.ts       (module types)
<name>.test.ts        (tests)
```

Database tables are **prefixed per module** (`auth_users`, `profile_profiles`,
`match_matches`, …) so they can be extracted into independent services later
(Clause 1 / Clause 4).

## Getting started

```bash
pnpm install
cp .env.example .env          # fill DATABASE_URL, secrets, provider keys
pnpm prisma:generate
pnpm prisma:migrate           # requires a reachable PostgreSQL
pnpm --filter @africonnect/api run dev
pnpm --filter @africonnect/web run dev
```

## Verification (no external services required)

These run on pure logic / type-checking and do **not** need Postgres:

```bash
pnpm typecheck                # tsc --noEmit across packages
pnpm lint                     # ESLint
pnpm test                     # Jest unit tests (formatting, scoring, crypto)
pnpm --filter @africonnect/api run prisma:validate
```

## Project layout

```
.
├── AGENTS.md                 # Engineering charter (law)
├── packages/
│   ├── shared/               # Errors, logger, constants, crypto, types
│   └── api/                  # Express API + Prisma
└── apps/
    └── web/                  # Next.js frontend (scaffold)
```

## Status

MVP scaffold: repository, module framework, Prisma schema, and core service
logic implemented and type-checked. End-to-end runtime requires a PostgreSQL
instance (see `.env.example`). See `CHANGELOG.md` for the running log.

## Quick start (deploy = fill credentials)

```bash
pnpm install                 # installs all workspace deps (incl. @clerk/nextjs)
cp .env.example .env         # root: API + infra secrets
cp apps/web/.env.example apps/web/.env   # web: public/site + Clerk keys
# Fill every value marked change-me / left blank. Then:
pnpm --filter @africonnect/api run prisma:migrate   # create DB schema
pnpm dev                     # api on :4000, web on :3000
```

### What each credential enables

- `DATABASE_URL` — Postgres connection (required to run).
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — session signing.
- `PII_MASTER_KEY` — AES-256-GCM encryption of personal data at rest.
- `TWILIO_*` / `SMS_PROVIDER=twilio` — real OTP + SMS over the internet (set `SMS_PROVIDER=console` for local dev logging).
- `STRIPE_*` — subscriptions/billing.
- `CLERK_*` + `NEXT_PUBLIC_AUTH_MODE=clerk` — hosted Clerk auth (optional; OTP is the default).
- `EMAIL_*` — transactional email (console logs in dev).
- `REDIS_URL` — OTP/rate-limit/session store (optional; in-memory fallback in dev).

No code changes are needed to go from local to production — only the `.env` values.
