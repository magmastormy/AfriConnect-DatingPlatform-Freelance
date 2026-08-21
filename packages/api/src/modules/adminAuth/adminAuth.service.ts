import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { IAdminAuthRepository } from './adminAuth.repository';
import { AdminAuthResult } from './adminAuth.types';
import { AuthenticationError, AuthorizationError, ValidationError, AuthedUser } from '@africonnect/shared';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@config/jwt';
import { assertWithinLimit } from '@config/rateLimiter';
import { config } from '@config/index';
import { logger } from '@africonnect/shared';
import { UserRole, UserStatus, asEnum } from '@africonnect/shared';

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface AdminSessionContext {
  deviceId?: string | null;
  ip?: string | null;
}

export interface IAdminAuthService {
  login(email: string, password: string, ctx: AdminSessionContext): Promise<AdminAuthResult>;
  bootstrap(email: string, password: string, setupToken: string, ctx: AdminSessionContext): Promise<AdminAuthResult>;
  refresh(refreshToken: string, ctx: AdminSessionContext): Promise<{ accessToken: string; refreshToken: string }>;
  logout(refreshToken: string): Promise<void>;
}

const ADMIN_ROLES = new Set(['admin', 'admin_vetting', 'admin_events', 'admin_billing', 'admin_support', 'admin_content', 'superadmin']);

export class AdminAuthService implements IAdminAuthService {
  constructor(private readonly repo: IAdminAuthRepository) {}

  async login(email: string, password: string, ctx: AdminSessionContext): Promise<AdminAuthResult> {
    await assertWithinLimit(`admin:login:${email}`, 5, 15 * 60 * 1000);
    await assertWithinLimit(`admin:login:ip:${ctx.ip ?? 'unknown'}`, 20, 15 * 60 * 1000);

    const admin = await this.repo.findAdminByEmail(email);
    if (!admin || !ADMIN_ROLES.has(admin.role)) {
      throw new AuthenticationError('Invalid admin credentials');
    }
    if (!admin.passwordHash) {
      throw new AuthenticationError('Admin account has no password — contact superadmin');
    }
    if (admin.status !== UserStatus.Active) {
      throw new AuthorizationError('Admin account is not active');
    }
    let ok = false;
    try {
      ok = await bcrypt.compare(password, admin.passwordHash);
    } catch {
      // A null/garbage hash (e.g. admin seeded without a password) makes
      // bcrypt throw instead of returning false — surface it as a normal
      // auth failure, never a 500.
      throw new AuthenticationError('Invalid admin credentials');
    }
    if (!ok) {
      logger.warn({ email }, 'Admin login failed — bad password');
      throw new AuthenticationError('Invalid admin credentials');
    }
    return this.issueTokens(admin, ctx);
  }

  async bootstrap(email: string, password: string, setupToken: string, ctx: AdminSessionContext): Promise<AdminAuthResult> {
    const expected = config.adminSetupToken;
    if (!expected || setupToken !== expected) {
      throw new AuthorizationError('Invalid setup token');
    }
    const count = await this.repo.countAdmins();
    if (count > 0) {
      throw new ValidationError('Admin already exists — use login');
    }
    if (password.length < 8) throw new ValidationError('Password must be at least 8 characters');
    const hash = await bcrypt.hash(password, 12);
    const admin = await this.repo.createAdmin(email, hash, 'superadmin');
    logger.info({ email, adminId: admin.id }, 'Admin bootstrap — first superadmin created');
    return this.issueTokens({ ...admin, passwordHash: hash }, ctx);
  }

  async refresh(refreshToken: string, ctx: AdminSessionContext): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: { sub: string; jti: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AuthenticationError('Invalid refresh token');
    }
    const session = await this.repo.findSessionByJti(payload.jti);
    if (!session || session.tokenHash !== hashToken(refreshToken)) {
      const byJti = await this.repo.findSessionByJti(payload.jti);
      if (byJti) await this.repo.revokeAllSessions(byJti.userId);
      throw new AuthenticationError('Refresh token revoked — please sign in again');
    }
    if (ctx.deviceId && session.deviceId && session.deviceId !== ctx.deviceId) {
      await this.repo.revokeAllSessions(session.userId);
      throw new AuthenticationError('New device detected — sessions revoked');
    }
    const user = await this.repo.findUserById(session.userId);
    if (!user || !ADMIN_ROLES.has(user.role)) throw new AuthenticationError('Account no longer exists');
    await this.repo.revokeSession(session.tokenHash);
    const issued = await this.issueTokensRaw(user, ctx);
    return { accessToken: issued.accessToken, refreshToken: issued.refreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    if (refreshToken) await this.repo.revokeSession(hashToken(refreshToken));
  }

  private async issueTokens(admin: { id: string; email: string; role: string; status: string; passwordHash?: string | null }, ctx: AdminSessionContext): Promise<AdminAuthResult> {
    const issued = await this.issueTokensRaw(admin, ctx);
    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      user: { id: admin.id, email: admin.email, role: admin.role, status: admin.status },
    };
  }

  private async issueTokensRaw(admin: { id: string; email: string; role: string; status: string }, ctx: AdminSessionContext): Promise<{ accessToken: string; refreshToken: string }> {
    const principal: AuthedUser = {
      userId: admin.id,
      role: asEnum<UserRole>(admin.role),
      email: admin.email,
      status: asEnum<UserStatus>(admin.status),
    };
    const jti = crypto.randomBytes(16).toString('base64url');
    const accessToken = signAccessToken(principal, { jti, deviceId: ctx.deviceId ?? '' });
    const refreshToken = signRefreshToken(admin.id, jti);
    const expiresAt = new Date(Date.now() + config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000);
    await this.repo.storeRefreshToken(admin.id, hashToken(refreshToken), jti, ctx.deviceId ?? null, ctx.ip ?? null, expiresAt);
    return { accessToken, refreshToken };
  }
}
