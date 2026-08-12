import crypto from 'crypto';

/** One OTP challenge bound to a phone number. */
export interface OtpEntry {
  code: string;
  expiresAt: number;
  attempts: number;
}

/**
 * Pluggable OTP store. The default in-memory implementation is correct for a
 * single-instance dev/preview deployment. In production, supply a Redis-backed
 * implementation with the same interface (set/get/delete) and inject it via the
 * composition root — no call-site changes required.
 */
export interface OtpStore {
  set(key: string, entry: OtpEntry): void;
  get(key: string): OtpEntry | undefined;
  delete(key: string): void;
}

/** Process-local OTP store. Suitable for a single API instance without Redis. */
export class InMemoryOtpStore implements OtpStore {
  private readonly store = new Map<string, OtpEntry>();

  set(key: string, entry: OtpEntry): void {
    this.store.set(key, entry);
  }

  get(key: string): OtpEntry | undefined {
    return this.store.get(key);
  }

  delete(key: string): void {
    this.store.delete(key);
  }
}

export function generateOtpCode(length: number): string {
  return String(crypto.randomInt(10 ** (length - 1), 10 ** length));
}
