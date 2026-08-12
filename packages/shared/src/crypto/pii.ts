import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

/**
 * AES-256-GCM encryption for PII at rest (AGENTS.md Clause 3.1).
 * Format of a ciphertext blob: base64( iv[12] || authTag[16] || ciphertext ).
 * The master key is 32 bytes, base64-encoded in PII_MASTER_KEY.
 */

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.PII_MASTER_KEY;
  if (!raw) {
    // In tests / dev without a key we fall back to a deterministic dev key so
    // the crypto helpers never crash. Production MUST set PII_MASTER_KEY.
    if (process.env.NODE_ENV === 'production') {
      throw new Error('PII_MASTER_KEY is required in production');
    }
    return Buffer.from('0123456789abcdef0123456789abcdef');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error('PII_MASTER_KEY must decode to a 32-byte key (base64)');
  }
  return key;
}

export function encryptPii(plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptPii(blob: string): string {
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}

/** RFC 4648-ish helper to produce a safe base64 master key. */
export function generateMasterKey(): string {
  return randomBytes(32).toString('base64');
}
