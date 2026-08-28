# Deploying AfriConnect Professionals

Target: **Vercel (web) + Render (API)**. Everything is container-agnostic; the API
also runs from its Dockerfile on Fly/Railway with the same env.

## 0. Secrets you must generate (never commit)

```bash
# Obfuscated API mount — used by BOTH the API and the web. Keep it secret.
openssl rand -hex 16            # -> API_MOUNT_PATH / NEXT_PUBLIC_API_MOUNT

# JWT signing secrets (32+ random bytes each)
openssl rand -base64 48         # -> JWT_SECRET
openssl rand -base64 48         # -> JWT_REFRESH_SECRET
```

## 1. Provision real credentials (each provider)

### Postgres (Aiven free tier)

1. Go to https://aiven.io/free-postgresql-database and create a **free PostgreSQL**
   service (pick a region close to your users, e.g. `gcp-europe-west1` or
   `aws-eu-west-1`). No credit card is required for the free tier.
2. Once the service is **Running**, open it and copy the **Service URI** — the full
   `postgresql://avnadmin:…@….aivencloud.com:…/defaultdb?sslmode=require` string.
   Aiven **requires TLS**, so the URI already ends in `?sslmode=require`. Never
   strip that parameter.
3. Paste that URI into `DATABASE_URL` in `.env` (local) **and** into the Render
   `DATABASE_URL` env var on the dashboard, so dev and production share one database.
   > Note: Aiven's free tier means dev + prod hit the *same* database. For a hard
   > separation later, provision a second Aiven service or a separate database/schema.

### Twilio Verify (phone OTP)

1. console.twilio.com → **Create a Verify service** (name: `AfriConnect`).
2. Copy the **Service SID** (`VA…`) → `TWILIO_VERIFY_SID`.
3. Account → **Account SID** (`AC…`) → `TWILIO_ACCOUNT_SID`.
4. Account → **Auth Token** → `TWILIO_AUTH_TOKEN`.
5. Optional: enable **WhatsApp** channel in the Verify service for WA OTP.
6. In `app.ts` CORS/rate-limit: OTP is sent server-side; no client keys needed.

### Stripe (billing)

1. dashboard.stripe.com → copy **Secret key** (sk_test_… / sk_live_…) → `STRIPE_SECRET_KEY`.
2. Developers → **Webhooks** → Add endpoint → URL `https://<api>/<mount>/v1/billing/webhook`.
3. Select events: `checkout.session.completed`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`.
4. Copy the **Signing secret** (`whsec_…`) → `STRIPE_WEBHOOK_SECRET`.
5. Add products/prices in Stripe and map their IDs into `billing.service`/`config`.

### Clerk (optional SSO)

1. dashboard.clerk.com → Create application → enable **Email + Phone** + OTP.
2. Copy **Publishable key** (`pk_…`) → `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (web) + `CLERK_PUBLISHABLE_KEY` (api).
3. Copy **Secret key** (`sk_…`) → `CLERK_SECRET_KEY` (api only).
4. Webhooks → Endpoint URL `https://<api>/<mount>/v1/auth/clerk/webhook`, events
   `user.created`, `user.updated`, `user.deleted` → copy **Signing secret** → `CLERK_WEBHOOK_SECRET`.
5. Set `NEXT_PUBLIC_AUTH_MODE=clerk` on the web and `CLERK_ENABLED=true` on the api to switch
   the `/auth` page to Clerk. Leave unset to use the built-in OTP auth.

### Email (contact + transactional)

Two options:

- **Resend**: resend.com -> add & verify a domain -> API key (`re_...`). Set
  `CONTACT_WEBHOOK_URL` to a small inbound endpoint, OR wire `lib/email.ts` to Resend.
- **Webhook relay** (zero-cost): point `CONTACT_WEBHOOK_URL` at a Slack/Discord
  incoming webhook so inquiries land in a channel. The contact route posts JSON there.

### Image Storage (Cloudflare R2)

R2 is the recommended production media storage. It is S3-compatible with zero
egress fees when served through the Cloudflare CDN.

1. Cloudflare Dashboard -> R2 -> **Create bucket** (e.g. `africonnect-media`).
2. Enable **Public access** on the bucket, or connect a custom domain for CDN.
3. R2 -> **Manage R2 API Tokens** -> Create token with Object Read & Write.
4. Copy the **Access Key ID** and **Secret Access Key**.
5. Set these env vars on the API:
   - `MEDIA_PROVIDER=r2`
   - `R2_ACCESS_KEY_ID` (from step 4)
   - `R2_SECRET_ACCESS_KEY` (from step 4)
   - `R2_ACCOUNT_ID` (Cloudflare account ID, visible in the dashboard URL)
   - `R2_BUCKET_NAME` (bucket name from step 1)
   - `R2_CDN_DOMAIN` (optional, e.g. `cdn.afri-connect.co.za`)
6. Test by uploading a profile photo and verifying the returned URL is accessible.

**Monitoring**: Check application logs for `CloudflareR2MediaStorage: upload
successful` and `CloudflareR2MediaStorage: remove successful` entries. Failed
operations log with error context. Cloudflare R2 access logs are available in
the Cloudflare dashboard.

**Migrating from Cloudinary**: See [`docs/migration-runbook-r2.md`](./docs/migration-runbook-r2.md)
for the full migration procedure.

## 2. API — Render

1. New → Blueprint → connect repo. Render reads `render.yaml`.
2. Set **all** `sync: false` env vars in the dashboard (Section 0 + 1):
   - `API_MOUNT_PATH`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`
   - `WEB_BASE_URL` (your Vercel URL), `CORS_ORIGINS` (`https://your-domain`)
   - `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID`
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   - `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `CLERK_WEBHOOK_SECRET` (if using Clerk)
   - `MEDIA_PROVIDER` (`r2` for production), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_CDN_DOMAIN` (if using R2)
   - `CONTACT_WEBHOOK_URL` (optional)
3. Render auto-runs `prisma migrate deploy` (preDeploy) then starts on port 4000.
   Health check: `GET /healthz`.
4. Note the API URL, e.g. `https://africonnect-api.onrender.com`.

## 3. Web — Vercel

1. New Project → import repo. Framework preset: **Next.js**.
2. Root directory: `.` (monorepo). Build: `pnpm --filter @africonnect/web build`.
3. Project env vars (must equal the API's mount):
   - `NEXT_PUBLIC_API_MOUNT` (= API_MOUNT_PATH)
   - `NEXT_PUBLIC_SITE_URL` (your production domain)
   - `NEXT_PUBLIC_API_WS` (`wss://africonnect-api.onrender.com`)
   - `API_BASE_URL` (`https://africonnect-api.onrender.com`)
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` (only if using Clerk)
   - `NEXT_PUBLIC_AUTH_MODE` (`clerk` or omit)
4. Deploy. The web proxies `/<mount>/v1/*` to the API (see `next.config.mjs`).

## 4. Database migration

The API runs `prisma migrate deploy` on boot (Render `preDeployCommand`). For a manual
migration against your Aiven database:

```bash
cd packages/api
DATABASE_URL=<your-aiven-service-uri> pnpm prisma migrate deploy
```

### P3009 — "migrate found failed migrations" (deploy stuck)

If a migration fails mid-deploy, Prisma records it as **failed** in `_prisma_migrations`
and every subsequent boot exits with `P3009` until the record is resolved. Fix the
migration SQL first, then mark the failed run as rolled back so the next deploy retries it:

```bash
cd packages/api
DATABASE_URL=<your-aiven-service-uri> pnpm prisma migrate resolve --rolled-back <migration_name>
DATABASE_URL=<your-aiven-service-uri> pnpm prisma migrate deploy   # retries the fixed migration
```

For services started via the **Dockerfile** this is already automated in its `CMD`.
For native Node-runtime Render services, use this resilient Start Command instead of a
bare `migrate deploy` (the `|| true` keeps boot working once nothing is failed):

```bash
pnpm --filter @africonnect/api exec prisma migrate resolve --rolled-back 20260822000000_provision_rls_app_role || true && pnpm --filter @africonnect/api exec prisma migrate deploy && node packages/api/dist/server.js
```

> Note: managed Postgres roles (Aiven `avnadmin`) are not superusers. Migrations that
> touch role attributes like `SUPERUSER`/`BYPASSRLS` must tolerate
> `insufficient_privilege` (see the wrapped `DO $$ … EXCEPTION` blocks in
> `20260822000000_provision_rls_app_role`) or they will fail exactly this way.

A baseline migration lives at `prisma/migrations/20260811000000_init/` (generated from
the schema via `prisma migrate diff --from-empty`). To author new migrations after
schema changes:

```bash
DATABASE_URL=... pnpm prisma migrate dev --name <describe_change>
```

## 5. WebSocket (live chat)

Realtime uses a single shared `ws` server on the API's HTTP port at `/<mount>/v1/ws`
(token in the query string). Render does **not** buffer/terminate WebSocket upgrades
by default. The web falls back to REST polling if the socket drops.

## 6. Local development (no Docker DB — Aiven)

The database is Aiven's free PostgreSQL, so you never run Postgres locally.

```bash
cp .env.example .env      # paste your Aiven Service URI into DATABASE_URL (?sslmode=require)
pnpm install
pnpm prisma:generate
pnpm --filter @africonnect/api exec prisma migrate deploy   # create tables on Aiven
# Run the API + web (hot reload) directly, or via Docker below
pnpm --filter @africonnect/api run dev
pnpm --filter @africonnect/web run dev
# web  -> http://localhost:3000
# api  -> http://localhost:4000
```

If you still want containers for the API + Web (no DB container), `docker compose up --build`
works — the `db` service was removed; the API reads `DATABASE_URL` straight from `.env`.

> `prisma migrate dev` (interactive, uses a shadow DB) also works, but on Aiven it
> auto-creates a `_prisma_shadow_db` database. Prefer `migrate deploy` for reproducible,
> CI-friendly schema creation.

## 7. Verify before shipping

```bash
hermes verify        # build + typecheck + test + lint across all packages
```

CI (`.github/workflows/ci.yml`) runs this on every push/PR.

## 8. Scaling & performance (high concurrency)

The service is a **modular monolith** designed to scale horizontally with zero code
changes — every instance is stateless and shares state only through Postgres + Redis.

### Horizontal scaling (load balancing)
- **Web (Vercel):** auto-scales at the edge; nothing to configure.
- **API (Render):** in the dashboard, raise the instance count on the
  `africonnect-api` service (the `starter` plan is single-instance; pick a plan that
  allows scaling, e.g. `standard`). Render's load balancer distributes traffic across
  all instances. No sticky sessions needed — auth is JWT, realtime is Redis-backed.
- **Do NOT** add in-process Node `cluster` inside the container. Each worker opens its
  own Prisma connection pool, which multiplies DB connections and blows past the Aiven
  connection quota. Horizontal scale via instances instead.

### Why it is already fleet-safe
- **Rate limiting is global, not per-instance.** `config/rateLimiter.ts` uses a
  Redis sliding-window (`redisSlidingWindow`), so the limit is enforced across the
  whole fleet, not N× per instance. Set `RATE_LIMIT_DISABLED=true` only for load tests.
- **Realtime chat is cross-instance.** `modules/chat/chat.ws.ts` publishes presence and
  messages over a Redis channel; a message sent on instance A is delivered to a
  subscriber connected to instance B. Works the moment you run >1 instance.
- **Connection pool is capped per instance.** `config/prisma.ts` sets
  `connection_limit` (default 5, override with `PRISMA_CONNECTION_LIMIT`) and
  `pool_timeout=20s` on the connection URL. With N instances the fleet uses
  roughly `N × connection_limit` connections — keep that under your Aiven quota
  (or put PgBouncer / Prisma Accelerate in front for transaction pooling).
- **Graceful shutdown** (`server.ts`) drains keep-alive sockets and disconnects Prisma
  on `SIGTERM`/`SIGINT`, so scale-down and deploys drop no in-flight requests.

### Load-balancer socket tuning
`server.ts` sets `keepAliveTimeout=65s` and `headersTimeout=66s` — a few seconds above a
typical 60s LB idle timeout. This prevents the classic "server closes a socket the LB
still thinks is open → 502 / ECONNRESET under load" race.

### Reducing payload size (mobile networks)
- The API compresses all compressible JSON/text responses with brotli/gzip
  (`config/compression.ts`, Node `zlib`, no extra dependency; 1 KB threshold so tiny
  bodies are not wasted CPU). Honours `Accept-Encoding`; sets `Vary: Accept-Encoding`.
- The web ships minified JS with `swcMinify` + `productionBrowserSourceMaps:false` +
  `compiler.removeConsole`, and serves images as AVIF/WebP via `next/image`.
- Hot read paths are Redis-cached (discover, matches, events, notifications, settings)
  with short TTLs, so the DB is hit far less than request volume.

### Connection pool quick reference
| Instances | PRISMA_CONNECTION_LIMIT | Approx. Postgres conns |
|-----------|------------------------|-----------------------|
| 1         | 5 (default)            | ~5                    |
| 3         | 5                      | ~15                   |
| 3         | 3                      | ~9                    |
| 5         | 3                      | ~15                   |

Lower `PRISMA_CONNECTION_LIMIT` as you add instances to stay within Aiven's free-tier
connection ceiling.
