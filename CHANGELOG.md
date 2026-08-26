# Changelog

All notable changes to this project are documented in this file.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Fixed

- Production deploy blocked by P3009: the `20260822000000_provision_rls_app_role`
  failure record was resolved (`migrate resolve --rolled-back`) against Aiven and the
  Aiven-safe migration re-applied successfully; documented the P3009 remedy and a
  resilient native-runtime Render Start Command in `DEPLOY.md`.

## [1.0.0] — 2026-08-10

### Added

- Monorepo scaffold (pnpm workspace + Turborepo) per `AGENTS.md` Clause 1.
- `packages/shared`: `AppError` hierarchy, pino logger, constants, AES-256-GCM PII
  crypto, HTTP envelope helpers, shared domain types.
- `packages/shared` enums mirroring the MVP data model (roles, statuses, cities,
  education levels — see `Technical_Stack_AfriConnect.md`).
- `packages/api`: Prisma schema with all MVP tables, prefixed per module
  (`auth_users`, `profile_profiles`, `match_matches`, `event_events`, …) and
  indexes from the stack document.
- Core API modules scaffolded (controller/service/repository/routes/schema/types):
  `auth`, `application`, `profile`, `match`, `chat`, `event`, `notification`,
  `billing`, `admin`.
- Rules-based compatibility scoring (Clause match spec) implemented as pure,
  unit-tested logic.
- Express app wiring: auth middleware, tiered rate limiting, Zod validation,
  centralized `AppError` handler, CORS, security headers.
- `apps/web` Next.js 14 shell (landing + portal) with shared TS config.
- `.env.example`, ESLint + Prettier config, CI-friendly verification scripts.
