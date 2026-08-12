# AGENTS.md

## AI Coding & Repository Management Charter

### AfriConnect Professionals — Curated Dating Platform

**Version:** 1.0  
**Effective Date:** August 2026  
**Applies To:** All AI agents, Copilots, and automated coding assistants operating on this repository.

> **Directive:** This document is law. Every line of code, every commit message, every architectural decision you generate must conform to these 8 clauses. When in doubt, choose the more rigorous option. When conflicts arise, Clause 1 overrides all.

---

## CLAUSE 1 — Architecture Philosophy: Modular Monolith, Microservices-Ready

**Principle:** Build a "modular monolith" — logically separated modules that can be physically extracted into microservices without rewrite.

### Rules:

1. **Module Isolation:** Every feature lives in its own directory under `packages/api/src/modules/{moduleName}/` with this exact structure:
   ```
   modules/
   ├── auth/
   │   ├── auth.controller.ts
   │   ├── auth.service.ts
   │   ├── auth.repository.ts
   │   ├── auth.routes.ts
   │   ├── auth.schema.ts      # Zod validation
   │   ├── auth.types.ts       # Module-specific types
   │   └── auth.test.ts
   ```
2. **No Cross-Module Imports:** A module may only import from:
   - Its own files
   - `packages/shared/` (universal types, constants, utilities)
   - Other modules ONLY through their **public interface** (`{module}.service.ts` exports)
3. **Dependency Direction:** `shared` → `modules` → `apps`. Never the reverse.
4. **Database-per-Module Schema:** Even in a single PostgreSQL instance, prefix tables by module: `auth_users`, `profile_profiles`, `match_matches`. This enables future schema extraction.
5. **No God Objects:** If a service file exceeds 400 lines, it must be decomposed into sub-services or utility classes.

**Enforcement:** Any PR that violates module boundaries must be rejected. Use `dependency-cruiser` to automate this check in CI.

---

## CLAUSE 2 — Code Quality: Enterprise-Grade Standards

**Principle:** Write code as if the next maintainer is a paranoid security auditor with a short temper. Every function must be observable, testable, and fault-tolerant.

### 2.1 Error Handling Architecture

Use a **hierarchical error system**. Never throw raw `Error`. Never return `null` for failures.

```typescript
// packages/shared/errors/AppError.ts
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly isOperational: boolean; // true = expected, false = bug

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON() {
    return {
      error: this.constructor.name,
      message: this.message,
      statusCode: this.statusCode,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack }),
    };
  }
}

// Domain-specific errors
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly isOperational = true;
}

export class AuthenticationError extends AppError {
  readonly statusCode = 401;
  readonly isOperational = true;
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly isOperational = true;
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly isOperational = true;
}

export class InternalError extends AppError {
  readonly statusCode = 500;
  readonly isOperational = false;
}
```

### 2.2 Repository Pattern with Prisma

Isolate all database access behind a repository. Never use Prisma client directly in controllers or services.

```typescript
// modules/profile/profile.repository.ts
import { PrismaClient, Profile } from '@prisma/client';
import { NotFoundError, InternalError } from '@shared/errors';
import { logger } from '@shared/logger';

export interface IProfileRepository {
  findById(id: string): Promise<Profile | null>;
  findByUserId(userId: string): Promise<Profile | null>;
  findMatches(criteria: MatchCriteria, pagination: Pagination): Promise<Profile[]>;
  create(data: CreateProfileInput): Promise<Profile>;
  update(id: string, data: UpdateProfileInput): Promise<Profile>;
  softDelete(id: string): Promise<void>;
}

export class ProfileRepository implements IProfileRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Profile | null> {
    try {
      return await this.prisma.profile.findUnique({
        where: { id },
        include: { photos: { orderBy: { order: 'asc' } } },
      });
    } catch (error) {
      logger.error({ error, profileId: id }, 'Repository: findById failed');
      throw new InternalError('Database operation failed', { operation: 'findById', id });
    }
  }

  async findMatches(criteria: MatchCriteria, { page, limit }: Pagination): Promise<Profile[]> {
    const skip = (page - 1) * limit;

    try {
      return await this.prisma.profile.findMany({
        where: {
          isPaused: false,
          isComplete: true,
          gender: criteria.preferredGender,
          city: criteria.city,
          educationLevel: { gte: criteria.minEducation },
          dateOfBirth: {
            gte: new Date(criteria.maxAge),
            lte: new Date(criteria.minAge),
          },
          id: { notIn: criteria.excludedIds },
        },
        orderBy: { completenessScore: 'desc' },
        skip,
        take: limit,
      });
    } catch (error) {
      logger.error({ error, criteria }, 'Repository: findMatches failed');
      throw new InternalError('Match query failed', { criteria });
    }
  }

  async create(data: CreateProfileInput): Promise<Profile> {
    try {
      return await this.prisma.profile.create({
        data: {
          ...data,
          completenessScore: this.calculateCompleteness(data),
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictError('Profile already exists for this user');
      }
      logger.error({ error, userId: data.userId }, 'Repository: create failed');
      throw new InternalError('Profile creation failed');
    }
  }

  async update(id: string, data: UpdateProfileInput): Promise<Profile> {
    const existing = await this.findById(id);
    if (!existing) {
      throw new NotFoundError('Profile not found', { profileId: id });
    }

    try {
      return await this.prisma.profile.update({
        where: { id },
        data: {
          ...data,
          completenessScore: this.calculateCompleteness({ ...existing, ...data }),
          updatedAt: new Date(),
        },
      });
    } catch (error) {
      logger.error({ error, profileId: id }, 'Repository: update failed');
      throw new InternalError('Profile update failed', { profileId: id });
    }
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.profile.update({
      where: { id },
      data: { isPaused: true, updatedAt: new Date() },
    });
  }

  private calculateCompleteness(data: Partial<Profile>): number {
    const fields = ['bio', 'profession', 'employer', 'educationLevel', 'interests', 'photos'];
    const filled = fields.filter((f) => {
      const val = data[f as keyof Profile];
      return (
        val !== null &&
        val !== undefined &&
        (typeof val !== 'string' || val.length > 0) &&
        (!Array.isArray(val) || val.length > 0)
      );
    }).length;
    return Math.round((filled / fields.length) * 100);
  }
}
```

### 2.3 Service Layer with Dependency Injection

Services contain business logic. They depend on repositories, not Prisma directly. Use constructor injection for testability.

```typescript
// modules/match/match.service.ts
import { IProfileRepository } from '@modules/profile/profile.repository';
import { IMatchRepository } from './match.repository';
import { INotificationService } from '@modules/notification/notification.service';
import { ValidationError, ConflictError } from '@shared/errors';
import { logger } from '@shared/logger';

export interface IMatchService {
  generateDailyMatches(userId: string): Promise<MatchResult[]>;
  expressInterest(
    userId: string,
    targetId: string,
    action: 'like' | 'pass' | 'superlike',
  ): Promise<MatchStatus>;
  getMutualMatches(userId: string): Promise<MatchResult[]>;
}

export class MatchService implements IMatchService {
  constructor(
    private readonly matchRepo: IMatchRepository,
    private readonly profileRepo: IProfileRepository,
    private readonly notificationService: INotificationService,
    private readonly config: MatchConfig,
  ) {}

  async generateDailyMatches(userId: string): Promise<MatchResult[]> {
    const userProfile = await this.profileRepo.findByUserId(userId);
    if (!userProfile) {
      throw new ValidationError('Complete your profile before viewing matches');
    }

    if (userProfile.isPaused) {
      throw new ValidationError('Your profile is currently paused');
    }

    const existingToday = await this.matchRepo.findTodaysMatches(userId);
    if (existingToday.length > 0) {
      logger.debug({ userId, count: existingToday.length }, 'Returning cached daily matches');
      return existingToday;
    }

    const candidates = await this.profileRepo.findMatches(
      {
        preferredGender: userProfile.preferences?.genderPreference,
        city: userProfile.city,
        minEducation: userProfile.preferences?.educationMin,
        minAge: this.calculateBirthDate(userProfile.preferences?.ageMax),
        maxAge: this.calculateBirthDate(userProfile.preferences?.ageMin),
        excludedIds: await this.getExcludedIds(userId),
      },
      { page: 1, limit: this.config.dailyMatchLimit },
    );

    const scored = candidates.map((candidate) => ({
      profile: candidate,
      score: this.calculateCompatibility(userProfile, candidate),
    }));

    const filtered = scored
      .filter((s) => s.score >= this.config.minCompatibilityThreshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, this.config.dailyMatchLimit);

    const saved = await this.matchRepo.createDailyQueue(
      userId,
      filtered.map((f) => ({ profileId: f.profile.id, score: f.score })),
    );

    logger.info({ userId, generated: saved.length }, 'Daily matches generated');
    return saved;
  }

  async expressInterest(
    userId: string,
    targetId: string,
    action: 'like' | 'pass' | 'superlike',
  ): Promise<MatchStatus> {
    if (userId === targetId) {
      throw new ValidationError('Cannot match with yourself');
    }

    const existing = await this.matchRepo.findBetweenUsers(userId, targetId);
    if (existing?.status === 'mutual') {
      throw new ConflictError('You are already matched with this user');
    }

    const result = await this.matchRepo.upsertAction(userId, targetId, action);

    if (result.status === 'mutual') {
      await this.notificationService.sendMutualMatchNotification(userId, targetId);
      await this.notificationService.sendMutualMatchNotification(targetId, userId);
      logger.info({ userId, targetId }, 'Mutual match created');
    }

    return result;
  }

  private calculateCompatibility(p1: Profile, p2: Profile): number {
    let score = 0;
    if (p2.educationLevel >= (p1.preferences?.educationMin ?? 0)) score += 30;
    if (p1.preferences?.professions?.includes(p2.profession)) score += 25;
    if (p2.city === p1.city) score += 20;
    const sharedInterests = p1.interests?.filter((i) => p2.interests?.includes(i)) ?? [];
    score += Math.min(sharedInterests.length * 5, 15);
    return Math.min(score, 100);
  }

  private calculateBirthDate(age: number | undefined): Date {
    if (!age) return new Date('1900-01-01');
    const d = new Date();
    d.setFullYear(d.getFullYear() - age);
    return d;
  }

  private async getExcludedIds(userId: string): Promise<string[]> {
    const [passed, blocked, matched] = await Promise.all([
      this.matchRepo.findPassedByUser(userId),
      this.matchRepo.findBlockedByUser(userId),
      this.matchRepo.findMatchedUserIds(userId),
    ]);
    return [...new Set([...passed, ...blocked, ...matched])];
  }
}
```

### 2.4 Controller Pattern

Controllers handle HTTP concerns only. No business logic. No direct DB access.

```typescript
// modules/match/match.controller.ts
import { Request, Response, NextFunction } from 'express';
import { IMatchService } from './match.service';
import { expressInterestSchema } from './match.schema';
import { asyncHandler } from '@shared/middleware/asyncHandler';

export class MatchController {
  constructor(private readonly matchService: IMatchService) {}

  getDailyMatches = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id; // Set by auth middleware
    const matches = await this.matchService.generateDailyMatches(userId);
    res.status(200).json({
      success: true,
      data: matches,
      meta: { generatedAt: new Date().toISOString(), count: matches.length },
    });
  });

  expressInterest = asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const { targetId, action } = expressInterestSchema.parse(req.body);

    const result = await this.matchService.expressInterest(userId, targetId, action);

    res.status(200).json({
      success: true,
      data: result,
    });
  });
}
```

### 2.5 Async Handler Middleware

Eliminate try/catch boilerplate in controllers.

```typescript
// packages/shared/middleware/asyncHandler.ts
import { Request, Response, NextFunction, RequestHandler } from 'express';

export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
```

### 2.6 Global Error Handler

Centralized error handling. Never leak stack traces in production.

```typescript
// packages/shared/middleware/errorHandler.ts
import { Request, Response, NextFunction } from 'express';
import { AppError } from '@shared/errors';
import { logger } from '@shared/logger';

export const errorHandler = (err: Error, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    logger.warn(
      {
        error: err.constructor.name,
        message: err.message,
        context: err.context,
        isOperational: err.isOperational,
      },
      'Operational error',
    );

    return res.status(err.statusCode).json(err.toJSON());
  }

  // Unknown error — potential bug
  logger.error({ error: err.message, stack: err.stack }, 'Unhandled error');

  return res.status(500).json({
    error: 'InternalError',
    message: process.env.NODE_ENV === 'development' ? err.message : 'An unexpected error occurred',
    statusCode: 500,
  });
};
```

### 2.7 Logging Standard

Use `pino` with structured JSON logs. Every log entry must include a `correlationId` for request tracing.

```typescript
// packages/shared/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'afri-connect-api', version: process.env.npm_package_version },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
  redact: {
    paths: ['password', '*.password', 'req.headers.authorization', '*.otp', '*.idDocumentUrl'],
    remove: true,
  },
});

// Request context logger (creates child logger with correlationId)
export const getRequestLogger = (correlationId: string) => {
  return logger.child({ correlationId });
};
```

### 2.8 Code Style Rules

- **TypeScript:** Strict mode enabled. No `any`. Use `unknown` with type guards.
- **Naming:** `PascalCase` for classes/types/interfaces, `camelCase` for functions/variables, `SCREAMING_SNAKE_CASE` for constants, `kebab-case` for files.
- **Functions:** Max 25 lines. Max 3 parameters (use config objects beyond that).
- **Imports:** Ordered: external → `@shared/` → `@modules/` → relative. Enforced by ESLint.
- **Comments:** Explain **why**, not **what**. Code must be self-documenting.
- **Magic Numbers:** Banned. All thresholds, limits, timeouts must be named constants in `packages/shared/constants.ts`.

---

## CLAUSE 3 — Security & Compliance: POPIA/GDPR by Design

**Principle:** Security is not a feature. It is the foundation. Every line of code must assume a motivated adversary.

### Rules:

1. **PII Encryption at Rest:** All personally identifiable information (names, emails, phones, ID numbers, addresses) must be encrypted using AES-256-GCM before storage. Use Prisma middleware for automatic encryption/decryption.
2. **No Raw PII in Logs:** Logged data must be redacted (see `logger.ts` redact config). Never log `req.body` containing passwords, OTPs, or ID documents.
3. **Input Sanitization:** All user inputs pass through Zod schemas. No raw SQL. No `eval()`. No `new Function()`.
4. **Rate Limiting:** Every endpoint protected by tiered rate limits:
   - Auth endpoints: 5 requests / 15 min / IP
   - API general: 100 requests / min / user
   - File uploads: 3 requests / hour / user
5. **CORS Strictness:** Whitelist only `https://afri-connect.co.za` and `https://app.afri-connect.co.za`. No wildcards.
6. **POPIA Compliance Checklist:**
   - [ ] Consent captured explicitly during application (checkbox, not pre-ticked)
   - [ ] Data minimization: collect only what is necessary for the service
   - [ ] Purpose limitation: data used only for matching and events
   - [ ] Retention limits: delete inactive accounts after 2 years (automated cron)
   - [ ] Right to deletion: `DELETE /profile/me` triggers 30-day purge job
   - [ ] Data portability: `GET /profile/me/export` returns JSON
   - [ ] Breach notification: 72-hour internal SLA, automated alerting
7. **File Upload Security:**
   - Presigned S3 URLs expire in 5 minutes
   - File types: JPG, PNG, PDF only (validated by magic numbers, not extension)
   - Max size: 5MB
   - EXIF metadata stripped via Lambda
   - Virus scan via ClamAV before processing
8. **Secret Management:** No secrets in code. Use AWS Secrets Manager or GitHub Actions secrets. Rotate quarterly.

---

## CLAUSE 4 — Database Integrity: The Source of Truth

**Principle:** The database is sacred. Every schema change is a contract. Every query is an audit trail.

### Rules:

1. **Schema-First Development:** All database changes via Prisma migrations. Never manually edit production DB.
   ```bash
   npx prisma migrate dev --name add_event_waitlist
   ```
2. **Migration Review:** Every migration file must be reviewed in PR. Migrations must be:
   - Reversible (have a `down` path)
   - Non-destructive for existing data (add columns as nullable first, backfill, then add constraint)
   - Idempotent (safe to run multiple times)
3. **Indexing Strategy:** Every `WHERE`, `JOIN`, and `ORDER BY` field must be indexed. Document rationale in migration comments:
   ```sql
   -- Index for match generation query (modules/match/match.service.ts:generateDailyMatches)
   CREATE INDEX idx_profile_matchable ON Profile(city, gender, educationLevel, isPaused, isComplete);
   ```
4. **Soft Deletes:** Never `DELETE` user data. Use `isDeleted` + `deletedAt` flags. Hard delete only in purge jobs after legal retention period.
5. **Foreign Key Constraints:** All relationships must have FK constraints with `ON DELETE` explicitly defined (prefer `SET NULL` or `RESTRICT` over `CASCADE` for user data).
6. **Audit Columns:** Every table must have `createdAt` and `updatedAt`. Sensitive tables (users, applications, payments) must have `createdBy`, `updatedBy` audit fields.
7. **Connection Pooling:** Use PgBouncer in transaction mode. Max connections: 20 per API instance.
8. **Query Performance:** All Prisma queries must use `select` or `include` to limit returned fields. No `findMany()` without `take` limit. Review slow query log weekly.

---

## CLAUSE 5 — API Design: RESTful, Versioned, Documented

**Principle:** APIs are user interfaces for developers. They must be predictable, consistent, and self-describing.

### Rules:

1. **URL Structure:**
   ```
   /api/v1/auth/...
   /api/v1/profile/...
   /api/v1/matches/...
   /api/v1/events/...
   /api/v1/billing/...
   /api/v1/admin/...          # Admin-only endpoints
   /api/v1/webhooks/stripe    # Third-party webhooks
   ```
2. **HTTP Methods:**
   - `GET` — Read (idempotent, cacheable)
   - `POST` — Create
   - `PUT` — Full update (idempotent)
   - `PATCH` — Partial update
   - `DELETE` — Remove (soft delete for user data)
3. **Response Envelope:** Every response follows this structure:
   ```json
   {
     "success": true,
     "data": { ... },
     "meta": {
       "page": 1,
       "limit": 20,
       "total": 150,
       "timestamp": "2026-08-10T11:47:00Z"
     },
     "error": null
   }
   ```
   Error response:
   ```json
   {
     "success": false,
     "data": null,
     "meta": { "timestamp": "2026-08-10T11:47:00Z" },
     "error": {
       "code": "VALIDATION_ERROR",
       "message": "Age must be between 21 and 65",
       "field": "dateOfBirth",
       "details": [{ "path": ["preferences", "ageMin"], "message": "..." }]
     }
   }
   ```
4. **Pagination:** Cursor-based for feeds (matches, messages). Offset-based for admin lists.
5. **Idempotency:** All mutation endpoints accept `Idempotency-Key` header. Store keys in Redis for 24 hours.
6. **OpenAPI:** Every endpoint must have JSDoc comments that auto-generate Swagger docs:
   ```typescript
   /**
    * @openapi
    * /api/v1/matches/daily:
    *   get:
    *     summary: Get today's curated matches
    *     tags: [Matches]
    *     security:
    *       - bearerAuth: []
    *     responses:
    *       200:
    *         description: List of matches
    *         content:
    *           application/json:
    *             schema: { $ref: '#/components/schemas/MatchList' }
    */
   ```
7. **Versioning:** URL versioning (`/v1/`, `/v2/`). Never break existing consumers. Maintain old versions for minimum 6 months after deprecation.
8. **WebSocket Events:** Document all Socket.io events in `docs/websocket-contract.md` with exact payload schemas.

---

## CLAUSE 6 — Testing: No Merge Without Coverage

**Principle:** Untested code is broken code. Every bug that reaches production is a failure of the test suite.

### Rules:

1. **Coverage Thresholds:**
   - Unit tests: 80% line coverage minimum
   - Integration tests: All API endpoints must have at least one happy-path and one error-path test
   - E2E tests: All critical user journeys (apply → pay → match → message → event)
2. **Test Pyramid:**
   ```
   E2E (Playwright)        — 5%  — Critical flows only
   Integration (Supertest) — 25% — API endpoints
   Unit (Jest)             — 70% — Services, utilities, pure functions
   ```
3. **Test Database:** Every integration test runs against a fresh PostgreSQL instance in Docker. Tests must be independent (no shared state).
4. **Naming Convention:**
   ```
   auth.service.ts      → auth.service.test.ts
   profile.repository.ts → profile.repository.test.ts
   ```
5. **Mock External Services:** Stripe, Twilio, SendGrid must be mocked in tests. Never hit real APIs in CI.
6. **Contract Tests:** If a module depends on another module's service, write contract tests verifying the interface.
7. **Flaky Test Policy:** Any test that fails intermittently must be fixed within 24 hours or disabled with a `TODO` linking to a P0 ticket.
8. **Pre-commit Hooks:** Husky runs `lint-staged` (ESLint + Prettier) and `npm test -- --changedSince=origin/main` before allowing commit.

---

## CLAUSE 7 — Documentation: Code Tells How, Docs Tell Why

**Principle:** The next developer (or AI) should understand the intent without reading the implementation.

### Rules:

1. **README per Module:** Every module directory contains a `README.md` explaining:
   - Purpose and scope
   - Public API surface (exports)
   - Dependencies on other modules
   - Data flow diagram (Mermaid)
   - Testing instructions
2. **Architecture Decision Records (ADRs):** Every significant architectural choice is documented in `docs/adr/YYYY-MM-DD-title.md` following this template:
   ```markdown
   # ADR-001: Modular Monolith over Microservices

   - Status: Accepted
   - Date: 2026-08-01
   - Context: MVP stage, small team, need for rapid iteration
   - Decision: Use modular monolith with clear module boundaries
   - Consequences: Simpler deployment, easier refactoring, future extraction possible
   ```
3. **Inline Documentation:**
   - Complex algorithms: Explain the "why" in block comments
   - Business rules: Reference the PRD section (e.g., `// See PRD §5.1.3: Daily match limit`)
   - TODOs: Must include issue number and deadline (e.g., `// TODO(#142): Replace rules-based scoring with ML by 2026-12-01`)
4. **API Documentation:** Auto-generated Swagger UI at `/api/docs`. Must be kept in sync with code.
5. **Event Documentation:** All WebSocket events documented in `docs/events.md` with sequence diagrams.
6. **Onboarding Guide:** `docs/ONBOARDING.md` must allow a new developer to run the full stack locally in <15 minutes.
7. **Changelog:** `CHANGELOG.md` follows Keep a Changelog format. Every PR updates it.
8. **Commit Messages:** Conventional Commits (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `security:`). Include ticket number: `feat(AUTH-42): add OTP expiry notification`.

---

## CLAUSE 8 — Deployment & Operations: You Break It, You Fix It

**Principle:** Code is not done until it is running in production, monitored, and rollback-ready.

### Rules:

1. **Environment Parity:** Development, staging, and production must use identical Docker images. Configuration only via environment variables.
2. **CI/CD Pipeline:**
   ```
   Push to feature/*    → Lint → Unit Tests → Build → Deploy Preview
   PR to develop        → + Integration Tests → Deploy Staging
   PR to main           → + E2E Tests → Code Review (2 approvals) → Deploy Production
   ```
3. **Database Migrations:** Run automatically in CI **before** app deployment. Migrations must be backward-compatible (app v2 can read db schema from v1).
4. **Feature Flags:** All new features behind LaunchDarkly (or env-based flags for MVP). Enable gradually: `dev → 5% staging → 50% staging → 10% prod → 100% prod`.
5. **Rollback Strategy:**
   - Application: One-click rollback to previous Docker image (<2 min)
   - Database: Migrations must be reversible. If irreversible, require manual DBA review
   - Feature flags: Instant disable without deployment
6. **Observability:**
   - **Metrics:** Request latency (p50, p95, p99), error rate, throughput
   - **Alerts:**
     - Error rate > 1% for 5 min → Slack #alerts
     - API p95 latency > 500ms for 10 min → Page on-call
     - Payment webhook failures > 3 in 1 hour → P0 incident
     - Database connections > 80% capacity → Auto-scale or investigate
   - **Dashboards:** Grafana (or Vercel/Railway native) with per-module breakdown
7. **Incident Response:**
   - SEV-1 (revenue-impacting, data loss): All-hands, fix within 1 hour
   - SEV-2 (feature degraded): Fix within 4 hours
   - SEV-3 (minor bug): Fix within 24 hours
   - Post-mortem required for all SEV-1 and SEV-2 within 48 hours
8. **Backup & Recovery:**
   - Database: Automated daily snapshots + point-in-time recovery (35 days)
   - File storage: S3 versioning enabled
   - Disaster recovery: Documented runbook in `docs/runbooks/`. Test DR drill quarterly.

---

## APPENDIX A — AI Agent Checklist

Before generating any code, verify:

- [ ] Does this change respect module boundaries (Clause 1)?
- [ ] Are all errors handled via AppError hierarchy (Clause 2)?
- [ ] Is PII encrypted and logged safely (Clause 3)?
- [ ] Is there a Prisma migration for schema changes (Clause 4)?
- [ ] Does the API response follow the envelope standard (Clause 5)?
- [ ] Are there accompanying tests with 80%+ coverage (Clause 6)?
- [ ] Is the change documented in README or ADR (Clause 7)?
- [ ] Can this be deployed safely with rollback capability (Clause 8)?

**If any check fails, stop and ask for clarification.**

---

## APPENDIX B — Quick Reference: File Templates

### New Module Scaffold

```bash
# Run this generator (or copy template)
npx hygen module new --name payment
# Generates: controller, service, repository, routes, schema, types, test
```

### New API Endpoint Checklist

1. Add Zod schema in `{module}.schema.ts`
2. Add route in `{module}.routes.ts`
3. Add controller method in `{module}.controller.ts`
4. Add service method in `{module}.service.ts`
5. Add repository method in `{module}.repository.ts`
6. Add integration test in `{module}.test.ts`
7. Update OpenAPI JSDoc
8. Update module README

---

_End of AGENTS.md — This document is a living contract. Amend via PR with 2 approvals._
