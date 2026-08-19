import { EventEmitter } from 'events';
import { config } from './index';
import { logger } from '@africonnect/shared';

/**
 * Shared-state backbone for horizontal scaling.
 *
 * Every API instance is stateless except for a few hot stores (OTP codes, rate
 * limits, WS presence, settings cache). Those MUST be shared across instances or
 * the platform misbehaves under a load balancer (OTP generated on one instance
 * fails to verify on another; rate limits become N× too loose; chat messages
 * don't reach a peer connected to a different instance).
 *
 * When REDIS_URL is configured (anything other than the localhost dev default)
 * we use Redis. Otherwise we degrade to an in-memory implementation so local
 * dev and tests run with zero infrastructure. The fallback is correct for a
 * single instance; for real horizontal scaling you MUST set REDIS_URL.
 */

const redisConfigured =
  !!process.env.REDIS_URL && process.env.REDIS_URL !== 'redis://localhost:6379';

// ── In-memory fallback ───────────────────────────────────────────────────────
interface MemEntry {
  value: string;
  expiresAt: number | null;
}
class MemoryKv {
  private map = new Map<string, MemEntry>();
  private timers = new Map<string, NodeJS.Timeout>();
  async get(key: string): Promise<string | null> {
    const e = this.map.get(key);
    if (!e) return null;
    if (e.expiresAt && e.expiresAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    return e.value;
  }
  async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    this.map.set(key, {
      value,
      expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
    });
    if (ttlSeconds) {
      const prev = this.timers.get(key);
      if (prev) clearTimeout(prev);
      this.timers.set(key, setTimeout(() => this.map.delete(key), ttlSeconds * 1000).unref());
    }
  }
  async del(key: string): Promise<void> {
    this.map.delete(key);
  }
}

// ── Unified backend ───────────────────────────────────────────────────────────
let redisClient: any = null;
const memKv = new MemoryKv();
const memWindows = new Map<string, number[]>();
const memPubSub = new EventEmitter();
memPubSub.setMaxListeners(0);

if (redisConfigured) {
  // Loaded lazily so the dependency is only required when actually used.
  import('ioredis')
    .then(({ default: Redis }) => {
      redisClient = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 2,
        lazyConnect: true,
        enableOfflineQueue: false,
      });
      redisClient.on('ready', () => logger.info('Redis connected (shared-state backbone)'));
      redisClient.on('error', (e: Error) =>
        logger.warn({ err: e.message }, 'Redis error — falling back to in-memory store'),
      );
      redisClient.connect().catch(() => {
        /* lazy; will retry on next command */
      });
    })
    .catch((e) => logger.warn({ err: e?.message }, 'ioredis not installed; using in-memory fallback'));
}

export const redisEnabled = redisConfigured;

// ── KV (JSON) ──────────────────────────────────────────────────────────────────
export async function redisGetJson<T>(key: string): Promise<T | null> {
  if (redisClient) {
    const raw = await redisClient.get(key);
    return raw ? (JSON.parse(raw) as T) : null;
  }
  const raw = await memKv.get(key);
  return raw ? (JSON.parse(raw) as T) : null;
}

export async function redisSetJson(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const raw = JSON.stringify(value);
  if (redisClient) {
    if (ttlSeconds) await redisClient.set(key, raw, 'EX', ttlSeconds);
    else await redisClient.set(key, raw);
    return;
  }
  await memKv.set(key, raw, ttlSeconds);
}

export async function redisDel(key: string): Promise<void> {
  if (redisClient) await redisClient.del(key);
  else await memKv.del(key);
}

// ── Sliding-window rate limit ───────────────────────────────────────────────────
export interface SlidingWindowResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export async function redisSlidingWindow(
  key: string,
  windowMs: number,
  max: number,
  now = Date.now(),
): Promise<SlidingWindowResult> {
  if (redisClient) {
    const cutoff = now - windowMs;
    await redisClient.zremrangebyscore(key, '-inf', cutoff);
    const count = (await redisClient.zcard(key)) as number;
    if (count >= max) {
      const oldest = (await redisClient.zrange(key, 0, 0)) as string[];
      const retryAfterMs = oldest.length ? Number(oldest[0]) + windowMs - now : windowMs;
      return { allowed: false, remaining: 0, retryAfterMs: Math.max(0, retryAfterMs) };
    }
    await redisClient.zadd(key, now, String(now));
    await redisClient.expire(key, Math.ceil(windowMs / 1000));
    return { allowed: true, remaining: max - count - 1, retryAfterMs: 0 };
  }
  // Memory fallback
  const hits = (memWindows.get(key) ?? []).filter((t) => t > now - windowMs);
  memWindows.set(key, hits);
  if (hits.length >= max) {
    return { allowed: false, remaining: 0, retryAfterMs: hits[0] + windowMs - now };
  }
  hits.push(now);
  return { allowed: true, remaining: max - hits.length, retryAfterMs: 0 };
}

// ── Pub/Sub (WS presence + cross-instance chat delivery) ─────────────────────────
export function redisPublish(channel: string, message: string): void {
  if (redisClient) {
    redisClient.publish(channel, message).catch(() => {});
    return;
  }
  memPubSub.emit(channel, message);
}

export function redisSubscribe(channel: string, handler: (message: string) => void): void {
  if (redisClient) {
    redisClient.subscribe(channel).catch(() => {});
    redisClient.on('message', (ch: string, msg: string) => {
      if (ch === channel) handler(msg);
    });
    return;
  }
  memPubSub.on(channel, handler);
}

export async function redisQuit(): Promise<void> {
  if (redisClient) await redisClient.quit().catch(() => {});
}
