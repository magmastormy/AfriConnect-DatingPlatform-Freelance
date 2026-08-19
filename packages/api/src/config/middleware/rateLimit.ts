import { Request, Response, NextFunction } from 'express';
import { RATE_LIMIT_GENERAL_MAX, RATE_LIMIT_GENERAL_WINDOW_MS } from '@africonnect/shared';
import { assertWithinLimit } from '../rateLimiter';
import { RateLimitError } from '@africonnect/shared';

/**
 * Tiered general rate limiting (AGENTS.md Clause 3.4). Per-IP for anon, per-user
 * when authed. Replace the in-memory limiter with Redis in production.
 */
export function rateLimitMiddleware(
  max: number = RATE_LIMIT_GENERAL_MAX,
  windowMs: number = RATE_LIMIT_GENERAL_WINDOW_MS,
) {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const key = req.user ? `u:${req.user.userId}` : `ip:${req.ip}`;
    try {
      await assertWithinLimit(key, max, windowMs);
      next();
    } catch (err) {
      if (err instanceof RateLimitError) return next(err);
      next(err);
    }
  };
}
