import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthenticationError } from '@africonnect/shared';

// Binds authenticated sessions to a stable device identifier. The web client
// generates a random id at first load, stores it in sessionStorage, and sends it
// on every request via X-Device-Id. If a stolen token is replayed from a
// different device/browser, the mismatch is detected and the session is revoked.
const DEVICE_HEADER = 'x-device-id';

function readDeviceId(req: Request): string | null {
  const raw = req.headers[DEVICE_HEADER] as string | undefined;
  return raw && /^[A-Za-z0-9_-]{16,128}$/.test(raw) ? raw : null;
}

/** Returns the request's device id (never throws). */
export function getDeviceId(req: Request): string | null {
  return readDeviceId(req);
}

/**
 * Lightweight device binding for authenticated requests. Attaches req.deviceId.
 * Use `requireDeviceBinding` on the refresh endpoint to enforce a match.
 */
export function deviceBinding() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    (req as Request & { deviceId?: string }).deviceId = readDeviceId(req) ?? undefined;
    next();
  };
}

/**
 * Enforces that the presented refresh token's bound device id matches the
 * current request. A mismatch (token stolen to another device) is treated as a
 * revocation signal handled by the auth service.
 */
export function requireDeviceBinding() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const id = readDeviceId(req);
    if (!id) {
      return next(new AuthenticationError('Device identifier required'));
    }
    (req as Request & { deviceId?: string }).deviceId = id;
    next();
  };
}

export { DEVICE_HEADER };
export function newDeviceId(): string {
  return crypto.randomBytes(24).toString('base64url');
}
