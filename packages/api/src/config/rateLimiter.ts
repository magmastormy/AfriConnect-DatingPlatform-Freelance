import { RateLimitError } from '@africonnect/shared';

/**
 * In-memory sliding-window rate limiter. Stand-in for Redis-backed limiting
 * (AGENTS.md Clause 3.4). Each (key, window) keeps a sorted list of timestamps;
 * entries older than the window are purged on access.
 */
interface Bucket {
  hits: number[];
  windowMs: number;
  max: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function rateLimit(
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): RateLimitResult {
  const bucket = buckets.get(key) ?? { hits: [], windowMs, max };
  const cutoff = now - windowMs;
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= max) {
    bucket.hits.push(now);
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: bucket.hits[0] + windowMs - now,
    };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return {
    allowed: true,
    remaining: max - bucket.hits.length,
    retryAfterMs: 0,
  };
}

/** Throws RateLimitError when the budget is exhausted. */
export function assertWithinLimit(key: string, max: number, windowMs: number, now?: number): void {
  const res = rateLimit(key, max, windowMs, now);
  if (!res.allowed) {
    throw new RateLimitError('Rate limit exceeded', { retryAfterMs: res.retryAfterMs });
  }
}
