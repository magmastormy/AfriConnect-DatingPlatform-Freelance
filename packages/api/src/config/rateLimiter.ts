import { RateLimitError } from '@africonnect/shared';
import { redisSlidingWindow } from '@config/redis';

/**
 * Shared (Redis-backed) sliding-window rate limiter.
 *
 * The previous implementation kept a process-local `buckets` Map, which is
 * correct only for a single API instance: behind a load balancer each instance
 * enforces its OWN limit, so an attacker (or just N instances) gets N× the
 * budget. This version delegates to the shared-state backbone (Redis when
 * REDIS_URL is set, in-memory fallback otherwise) so the limit is enforced
 * globally across the horizontal fleet.
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export async function rateLimit(
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): Promise<RateLimitResult> {
  return redisSlidingWindow(key, max, windowMs, now);
}

/** Throws RateLimitError when the budget is exhausted. */
export async function assertWithinLimit(
  key: string,
  max: number,
  windowMs: number,
  now?: number,
): Promise<void> {
  const res = await rateLimit(key, max, windowMs, now);
  if (!res.allowed) {
    throw new RateLimitError('Rate limit exceeded', { retryAfterMs: res.retryAfterMs });
  }
}
