import crypto from 'crypto';
import { redisGetJson, redisSetJson, redisDel } from '@config/redis';

/** One OTP challenge bound to a phone number. */
export interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

/**
 * Pluggable OTP store. The default implementation is backed by the shared-state
 * backbone (Redis when REDIS_URL is set, otherwise in-memory), so an OTP code
 * generated on one API instance can be verified on another — required for
 * correct horizontal scaling behind a load balancer. Swap the implementation at
 * the composition root if you need a different backend; the interface is async.
 */
export interface OtpStore {
  set(key: string, entry: OtpEntry): Promise<void>;
  get(key: string): Promise<OtpEntry | null>;
  delete(key: string): Promise<void>;
}

const OTP_TTL_SECONDS = (Number(process.env.OTP_TTL_MINUTES) || 10) * 60 + 60;

/** Shared (Redis-backed) OTP store. Suitable for multi-instance deployments. */
export class InMemoryOtpStore implements OtpStore {
  async set(key: string, entry: OtpEntry): Promise<void> {
    await redisSetJson(`otp:${key}`, entry, OTP_TTL_SECONDS);
  }

  async get(key: string): Promise<OtpEntry | null> {
    return redisGetJson<OtpEntry>(`otp:${key}`);
  }

  async delete(key: string): Promise<void> {
    await redisDel(`otp:${key}`);
  }
}

export function generateOtpCode(length: number): string {
  return String(crypto.randomInt(10 ** (length - 1), 10 ** length));
}
