import { PrismaClient } from '@prisma/client';
import { logger } from '@africonnect/shared';
import { getRequestContext } from './requestContext';

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
 */
export const prisma = rawPrisma.$extends({
  query: {
    async $allOperations({ model, operation, args, query }) {
      if (!RLS_ENABLED) return query(args);
      if (!model) return query(args); // raw queries / transactions pass through

      const ctx = getRequestContext();
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
    await rawPrisma.$executeRawUnsafe(`ALTER TABLE "${table}" ENABLE ROW LEVEL SECURITY`);
  }
  logger.info({ tables: RLS_TABLES.length }, 'RLS enabled on user-owned tables');
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
