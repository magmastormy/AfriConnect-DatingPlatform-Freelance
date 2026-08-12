import { encryptPii, decryptPii, generateMasterKey } from './crypto/pii';
import { success, errorPayload, toPagination } from './http/envelope';
import { ValidationError, InternalError, isAppError } from './errors/AppError';

describe('PII crypto', () => {
  it('round-trips plaintext through AES-256-GCM', () => {
    const secret = 'tendai@example.com + ID 12345678';
    const blob = encryptPii(secret);
    expect(blob).not.toContain(secret);
    expect(decryptPii(blob)).toBe(secret);
  });

  it('produces a different blob each time (random IV)', () => {
    const a = encryptPii('same');
    const b = encryptPii('same');
    expect(a).not.toBe(b);
    expect(decryptPii(a)).toBe('same');
    expect(decryptPii(b)).toBe('same');
  });

  it('fails tamper detection', () => {
    const blob = encryptPii('tamper-me');
    const buf = Buffer.from(blob, 'base64');
    buf[buf.length - 1] ^= 0xff; // flip a bit in the ciphertext
    expect(() => decryptPii(buf.toString('base64'))).toThrow();
  });

  it('generateMasterKey yields a 32-byte base64 key', () => {
    const k = generateMasterKey();
    expect(Buffer.from(k, 'base64').length).toBe(32);
  });
});

describe('HTTP envelope', () => {
  it('wraps success data with a timestamp', () => {
    const res = success({ id: 'x' }, { page: 1, limit: 20, total: 1 });
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ id: 'x' });
    expect(res.meta?.page).toBe(1);
    expect(res.meta?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('builds an error payload', () => {
    const e = errorPayload('VALIDATION_ERROR', 'bad', 'email', { min: 1 });
    expect(e.success).toBe(false);
    expect(e.error.code).toBe('VALIDATION_ERROR');
    expect(e.error.field).toBe('email');
  });

  it('clamps pagination to safe bounds', () => {
    expect(toPagination(0, 99999).limit).toBe(100);
    expect(toPagination(-3, 0).page).toBe(1);
    expect(toPagination(2, 10).skip).toBe(10);
  });
});

describe('AppError hierarchy', () => {
  it('carries status codes and operational flag', () => {
    const v = new ValidationError('nope');
    const i = new InternalError('boom');
    expect(v.statusCode).toBe(400);
    expect(v.isOperational).toBe(true);
    expect(i.statusCode).toBe(500);
    expect(i.isOperational).toBe(false);
    expect(isAppError(v)).toBe(true);
  });
});
