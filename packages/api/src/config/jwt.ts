import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { config } from './index';
import { AuthedUser } from '@africonnect/shared';

export interface AccessTokenPayload {
  sub: string;
  role: string;
  email: string;
  status: string;
  // Opaque session id (jti) — allows revoking a single session.
  jti: string;
  // Device binding: a stolen token replayed from another device is detectable.
  did: string;
}

function newJti(): string {
  return crypto.randomBytes(16).toString('base64url');
}

export function signAccessToken(
  user: AuthedUser,
  opts: { jti?: string; deviceId?: string } = {},
): string {
  const payload: AccessTokenPayload = {
    sub: user.userId,
    role: user.role,
    email: user.email,
    status: user.status,
    jti: opts.jti ?? newJti(),
    did: opts.deviceId ?? '',
  };
  return jwt.sign(payload, config.jwt.accessSecret, {
    expiresIn: `${config.jwt.accessTtlMinutes}m`,
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, config.jwt.accessSecret) as AccessTokenPayload;
}

export function signRefreshToken(userId: string, jti: string): string {
  // Embed the session jti so rotation/reuse-detection can identify the session.
  return jwt.sign({ sub: userId, jti }, config.jwt.refreshSecret, {
    expiresIn: `${config.jwt.refreshTtlDays}d`,
  });
}

export function verifyRefreshToken(token: string): { sub: string; jti: string } {
  return jwt.verify(token, config.jwt.refreshSecret) as { sub: string; jti: string };
}
