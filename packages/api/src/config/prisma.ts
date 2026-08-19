import { PrismaClient } from '@prisma/client';
import { logger } from '@africonnect/shared';
import { getRequestContext, BOOTSTRAP_TENANT_ID, RequestContext } from './requestContext';

/**
 * Build a connection URL with a capped pool size. Under horizontal scaling
 * (Render runs N API instances) every instance opens its own Prisma pool; if
 * each takes the driver default (~2×CPU+1) we blow past Aiven's small
 * connection quota and the whole fleet starts failing with "too many
 * connections". Capping connection_limit keeps the fleet within budget — pair
 * it with Aiven's connection pooler (PgBouncer) or Prisma Accelerate for
 * serverless-style transaction pooling in production.
 *
 * An explicit connection_limit already present in DATABASE_URL is respected;
 * otherwise we apply PRISMA_CONNECTION_LIMIT (default 5).
 */
function buildDatabaseUrl(): string {
  const raw = process.env.DATABASE_URL || '';
  if (!raw) return raw;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw; // not a URL we can parse; let Prisma surface the error
  }
  const limit = Number(process.env.PRISMA_CONNECTION_LIMIT) || 5;
  if (!url.searchParams.has('connection_limit')) {
    url.searchParams.set('connection_limit', String(limit));
  }
  if (!url.searchParams.has('pool_timeout')) {
    url.searchParams.set('pool_timeout', '20');
  }
  return url.toString();
}

/** Row-Level Security is OFF by default. The migration creates the policies,
 * but enforcement only switches on when RLS_ENABLED=true AND the app has run
 * `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` at boot (see enableRls). This
 * kill-switch lets us ship the full isolation layer without it ever silently
 * blocking legitimate reads before it has been smoke-tested against a live DB. */
export const RLS_ENABLED = (process.env.RLS_ENABLED ?? 'false').toLowerCase() === 'true';

/** Un-extended client. Used for: migrations, the chat module's internal
 * transaction (which would otherwise nest inside the RLS transaction wrapper),
 * and any trusted system operation that must bypass RLS explicitly. */
export const rawPrisma = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl() } },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

/**
 * Every user-owned table that RLS applies to. The migration adds the policies;
 * enableRls/disableRls toggle enforcement on exactly these tables. Kept in sync
 * with the schema's user-owned models (see schema.prisma).
 */
const RLS_TABLES = [
  'auth_users',
  'auth_sessions',
  'auth_verification_tokens',
  'vetting_applications',
  'profile_profiles',
  'match_matches',
  'match_daily_queues',
  'chat_conversations',
  'chat_messages',
  'event_rsvps',
  'event_stars',
  'billing_subscriptions',
  'billing_payments',
  'notify_notifications',
  'notify_preferences',
  'vetting_sessions',
  'admin_audit_logs',
  'analytics_profile_views',
];

function camel(model: string): string {
  return model.charAt(0).toLowerCase() + model.slice(1);
}

/**
 * RLS-extended client. Every operation runs inside an interactive transaction
 * in which we set the request GUCs, then re-dispatches the operation on the
 * transaction client (which carries the GUC). `SET LOCAL` only lives for the
 * transaction, so it is safe under a pooled connection and cannot leak a
 * user's context into another request.
 *
 * Policy outcome per request:
 *  - authenticated user  -> scoped to app.current_user_id / app.current_tenant_id
 *  - admin role / no context (webhook, system) -> app.bypass_rls = on (trusted)
 *
 * IMPORTANT (context propagation): Prisma invokes `$allOperations` on an async
 * boundary that DROPS the AsyncLocalStorage store, so reading getRequestContext()
 * inside the extension always returns undefined (and would force bypass). We
 * therefore capture the request context SYNCHRONOUSLY at access time via
 * getPrisma() — which is called from synchronous repository code still inside
 * the runRequestContext() scope — and bind it into a per-request scoped client.
 * The scoped client is memoized on the request's context object so each request
 * gets exactly one extended client, and concurrent requests never share state.
 */
function makeScopedClient(client: PrismaClient, ctx: RequestContext | null): PrismaClient {
  return client.$extends({
    query: {
      async $allOperations({ model, operation, args, query }) {
        if (!RLS_ENABLED || !model) return query(args);
        const bypass = !!ctx?.bypassRls || !ctx?.userId;
        return rawPrisma.$transaction(async (tx: any) => {
          if (bypass) {
            await tx.$executeRawUnsafe(`SELECT set_config('app.bypass_rls', 'on', true)`);
          } else {
            await tx.$executeRawUnsafe(`SELECT set_config('app.current_user_id', $1, true)`, ctx!.userId);
            await tx.$executeRawUnsafe(`SELECT set_config('app.current_tenant_id', $1, true)`, ctx!.tenantId);
          }
          const delegate = tx[camel(model)];
          return delegate[operation](args);
        });
      },
    },
  }) as unknown as PrismaClient;
}

let systemClient: PrismaClient | null = null;
function getSystemClient(): PrismaClient {
  if (!systemClient) systemClient = makeScopedClient(rawPrisma, { tenantId: BOOTSTRAP_TENANT_ID, bypassRls: true });
  return systemClient;
}

/**
 * Resolve the Prisma client for the current request. MUST be called from
 * synchronous code that runs inside runRequestContext() so the context is
 * available. System/webhook code (no context) gets the bypass client.
 */
export function getPrisma(): PrismaClient {
  if (!RLS_ENABLED) return rawPrisma;
  const ctx = getRequestContext();
  if (!ctx) return getSystemClient();
  const existing = (ctx as RequestContext & { __rlsClient?: PrismaClient }).__rlsClient;
  if (existing) return existing;
  const scoped = makeScopedClient(rawPrisma, ctx);
  (ctx as RequestContext & { __rlsClient?: PrismaClient }).__rlsClient = scoped;
  return scoped;
}

/**
 * Drop-in replacement for the old global `prisma`. Every property access is
 * delegated to the per-request scoped client resolved by getPrisma(), so no
 * repository code needs to change. Under RLS-off it is just rawPrisma.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_t, prop) {
    const client = getPrisma();
    const val = (client as any)[prop];
    return typeof prop === 'string' && typeof val === 'function' ? val.bind(client) : val;
  },
}) as unknown as PrismaClient;

/** Reconcile RLS enforcement with the RLS_ENABLED switch. Idempotent. */
export async function reconcileRls(): Promise<void> {
  if (!RLS_ENABLED) {
    await disableRls();
    return;
  }
  await enableRls();
}

async function enableRls(): Promise<void> {
  for (const table of RLS_TABLES) {
    // FORCE (not just ENABLE) so the policies also apply to the table owner.
    // CRITICAL: RLS is bypassed entirely for superusers, so the API MUST connect
    // as a least-privilege, non-superuser role (e.g. `africonnect_app`) — never
    // the bootstrap/superuser role. Otherwise these policies are silently inert.
    // (Verified by the live RLS smoke test: superuser connection leaked all rows.)
    await rawPrisma.$executeRawUnsafe(`ALTER TABLE "${table}" FORCE ROW LEVEL SECURITY`);
  }
  logger.info({ tables: RLS_TABLES.length }, 'RLS forced on user-owned tables (non-superuser roles subject)');
}

async function disableRls(): Promise<void> {
  for (const table of RLS_TABLES) {
    await rawPrisma.$executeRawUnsafe(`ALTER TABLE "${table}" DISABLE ROW LEVEL SECURITY`);
  }
}

rawPrisma.$connect().catch((err) => {
  // Surface connection failures early; the process should not silently run
  // with a dead pool. (Prisma lazily connects, so this is a best-effort probe.)
  logger.error({ err }, 'Prisma: initial connection probe failed');
});

// When RLS is on, make sure enforcement matches the switch as soon as we connect.
if (RLS_ENABLED) {
  rawPrisma.$connect().then(reconcileRls).catch(() => {
    /* connection probe already logged the failure */
  });
}
