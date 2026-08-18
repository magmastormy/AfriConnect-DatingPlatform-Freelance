import { PrismaClient } from '@prisma/client';
import { logger } from '@africonnect/shared';

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

/** Single Prisma instance shared across the API (pooled by the driver). */
export const prisma = new PrismaClient({
  datasources: { db: { url: buildDatabaseUrl() } },
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

prisma.$connect().catch((err) => {
  // Surface connection failures early; the process should not silently run
  // with a dead pool. (Prisma lazily connects, so this is a best-effort probe.)
  logger.error({ err }, 'Prisma: initial connection probe failed');
});
