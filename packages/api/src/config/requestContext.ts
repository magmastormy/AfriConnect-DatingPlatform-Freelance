import { AsyncLocalStorage } from 'async_hooks';

/**
 * Per-request security context used to power database-level row isolation
 * (PostgreSQL Row-Level Security). We thread the authenticated user's id and
 * tenant through AsyncLocalStorage so the Prisma RLS extension can issue
 * `SET LOCAL app.current_user_id` / `app.current_tenant_id` for every query —
 * without having to plumb `userId` through every repository signature.
 *
 * This is DEFENSE IN DEPTH on top of the service-layer userId scoping that
 * already exists: even if a future query forgets to filter by userId, RLS
 * still prevents one user's private rows from being read or mutated by another.
 */
export interface RequestContext {
  userId?: string;
  tenantId: string;
  /** Admin / back-office roles bypass RLS because they legitimately operate
   * across users (review applications, manage members, audit). Trusted. */
  bypassRls?: boolean;
}

/** The single tenant id used until/unless real multi-tenant partitioning exists. */
export const BOOTSTRAP_TENANT_ID = process.env.BOOTSTRAP_TENANT_ID || 'tnt_bootstrap';

const store = new AsyncLocalStorage<RequestContext>();

export function runRequestContext<T>(ctx: RequestContext, fn: () => T): T {
  return store.run(ctx, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return store.getStore();
}
