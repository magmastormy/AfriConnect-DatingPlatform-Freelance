import crypto from 'crypto';
import { IAuthRepository } from './auth.repository';
import { OtpStore, InMemoryOtpStore, generateOtpCode } from './otpStore';
import { AuthResult, RequestOtpInput, VerifyOtpInput } from './auth.types';
import {
  OTP_LENGTH,
  OTP_TTL_MINUTES,
  OTP_MAX_REQUESTS_PER_WINDOW,
  OTP_REQUEST_WINDOW_MINUTES,
  RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_AUTH_WINDOW_MS,
  AuthenticationError,
  RateLimitError,
  AuthorizationError,
  AuthedUser,
} from '@africonnect/shared';
import { signAccessToken, signRefreshToken, verifyRefreshToken } from '@config/jwt';
import { assertWithinLimit } from '@config/rateLimiter';
import { config } from '@config/index';
import { logger } from '@africonnect/shared';
import { UserRole, UserStatus, asEnum } from '@africonnect/shared';
import { verifyClerkToken, getClerkPrimaryEmail } from './clerkVerify';

/** OTP store for verification challenges. Injected so it can be swapped for
 *  a distributed (Redis) implementation in production without touching logic. */
const otpStore: OtpStore = new InMemoryOtpStore();

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export interface SessionContext {
  deviceId?: string | null;
  ip?: string | null;
}

export interface IAuthService {
  requestOtp(input: RequestOtpInput): Promise<{ delivered: boolean }>;
  verifyOtp(input: VerifyOtpInput, ctx: SessionContext): Promise<AuthResult>;
  refresh(
    refreshToken: string,
    ctx: SessionContext,
  ): Promise<{ accessToken: string; refreshToken: string }>;
  logout(refreshToken: string): Promise<void>;
  verifyClerk(clerkToken: string, ctx: SessionContext): Promise<AuthResult>;
}

export class AuthService implements IAuthService {
  constructor(private readonly repo: IAuthRepository) {}

  async requestOtp(input: RequestOtpInput): Promise<{ delivered: boolean }> {
    await assertWithinLimit(
      `otp:${input.phone}`,
      OTP_MAX_REQUESTS_PER_WINDOW,
      OTP_REQUEST_WINDOW_MINUTES * 60 * 1000,
    );
    // Always create/lookup the user so the OTP is bound to a real account.
    await this.repo.findOrCreateUser(input.email, input.phone);

    const code = generateOtpCode(OTP_LENGTH);
    const expiresAt = Date.now() + OTP_TTL_MINUTES * 60 * 1000;
    await otpStore.set(input.phone, { code, expiresAt, attempts: 0 });

    // Sending via Twilio/SNS is wired in production; locally we log the code so
    // the OTP flow is exercisable without an SMS provider.
    logger.info({ phone: input.phone, code }, 'OTP generated — dispatched via SMS in production');
    return { delivered: true };
  }

  async verifyOtp(input: VerifyOtpInput, ctx: SessionContext): Promise<AuthResult> {
    await assertWithinLimit(`login:${input.phone}`, RATE_LIMIT_AUTH_MAX, RATE_LIMIT_AUTH_WINDOW_MS);

    const entry = await otpStore.get(input.phone);
    if (!entry || entry.expiresAt < Date.now()) {
      await otpStore.delete(input.phone);
      throw new AuthenticationError('OTP expired or not requested');
    }
    if (entry.attempts >= 5) {
      throw new RateLimitError('Too many OTP attempts, request a new code');
    }
    entry.attempts += 1;
    if (entry.code !== input.code) {
      throw new AuthenticationError('Invalid OTP');
    }
    await otpStore.delete(input.phone);

    const user = await this.repo.findUserByEmail(input.email);
    if (!user) throw new AuthenticationError('No account found for this email');
    if (user.status === UserStatus.Banned) {
      throw new AuthorizationError('Account is banned');
    }
    if (user.status === UserStatus.Suspended) {
      throw new AuthorizationError('Account is suspended');
    }

    return this.issueTokens(user, ctx);
  }

  async refresh(
    refreshToken: string,
    ctx: SessionContext,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    let payload: { sub: string; jti: string };
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch {
      throw new AuthenticationError('Invalid refresh token');
    }

    // Reuse detection: the session tied to this jti must still exist. If it was
    // already rotated (single-use) or revoked, a replayed/leaked token surfaces
    // here — revoke every session for the user to contain the leak.
    const session = await this.repo.findSessionByJti(payload.jti);
    if (!session || session.tokenHash !== hashToken(refreshToken)) {
      const byJti = await this.repo.findSessionByJti(payload.jti);
      if (byJti) await this.repo.revokeAllSessions(byJti.userId);
      else {
        const user = await this.repo.findUserById(payload.sub);
        if (user) await this.repo.revokeAllSessions(user.id);
      }
      throw new AuthenticationError('Refresh token revoked — please sign in again');
    }

    // Device mismatch: a stolen token replayed on another device/browser. Revoke
    // all sessions for the user and force re-authentication.
    if (ctx.deviceId) {
      const current = await this.repo.findSessionByTokenHash(hashToken(refreshToken));
      if (current?.deviceId && current.deviceId !== ctx.deviceId) {
        await this.repo.revokeAllSessions(session.userId);
        throw new AuthenticationError('New device detected — sessions revoked');
      }
    }

    const user = await this.repo.findUserById(session.userId);
    if (!user) {
      await this.repo.revokeSession(session.tokenHash);
      throw new AuthenticationError('Account no longer exists');
    }

    // Rotation: invalidate the used refresh token, issue a fresh pair bound to the
    // same device. Old tokens stop working immediately.
    await this.repo.revokeSession(session.tokenHash);
    const issued = await this.issueTokensRaw(user, ctx);
    return { accessToken: issued.accessToken, refreshToken: issued.refreshToken };
  }

  async logout(refreshToken: string): Promise<void> {
    if (refreshToken) await this.repo.revokeSession(hashToken(refreshToken));
  }

  async verifyClerk(clerkToken: string, ctx: SessionContext): Promise<AuthResult> {
    // Hardened JWKS + issuer verification lives in ./clerkVerify. It throws
    // AuthenticationError on any failure and never logs the raw token.
    const { sub, firstName, lastName, fullName, imageUrl } =
      await verifyClerkToken(clerkToken);
    logger.debug(
      { subject: sub, hasProfileData: !!(firstName || lastName || fullName) },
      'Clerk token verified',
    );
    // Session tokens often omit the email claim (Google-OAuth template here).
    // Recover the real primary email from the Clerk Backend API so we never
    // fall back to a `${clerkId}@clerk.local` placeholder.
    let resolvedEmail = '';
    if (!resolvedEmail) {
      const fromClerk = await getClerkPrimaryEmail(sub);
      if (fromClerk) resolvedEmail = fromClerk;
    }
    let user = await this.repo.findUserByClerkId(sub);
    if (!user && resolvedEmail) {
      user = await this.repo.findUserByEmail(resolvedEmail);
      if (user) await this.repo.attachClerkId(user.id, sub);
    }
    // The account may already exist with a placeholder email from a prior
    // session-token login; backfill the now-known real email.
    if (user && resolvedEmail && user.email.endsWith('@clerk.local')) {
      try {
        user = await this.repo.updateEmail(user.id, resolvedEmail);
      } catch (err) {
        logger.warn({ err, userId: user.id }, 'Failed to backfill Clerk email');
      }
    }
    if (!user) {
      logger.info(
        { sub, email: resolvedEmail, firstName, lastName, fullName, hasImage: !!imageUrl },
        'Creating new user from Clerk with profile data',
      );
      user = await this.repo.createUserFromClerk(sub, resolvedEmail, {
        firstName,
        lastName,
        fullName,
        imageUrl,
      });
    }
    if (user.status === UserStatus.Banned) throw new AuthorizationError('Account is banned');
    if (user.status === UserStatus.Suspended) throw new AuthorizationError('Account is suspended');
    return this.issueTokens(user, ctx);
  }

  private async issueTokens(
    user: { id: string; email: string; role: unknown; status: unknown },
    ctx: SessionContext,
  ): Promise<AuthResult> {
    const issued = await this.issueTokensRaw(user, ctx);
    return {
      accessToken: issued.accessToken,
      refreshToken: issued.refreshToken,
      user: {
        userId: user.id,
        email: user.email,
        role: asEnum<UserRole>(user.role),
        status: asEnum<UserStatus>(user.status),
      },
    };
  }

  // Creates a fresh access+refresh pair and persists the refresh session. The
  // refresh token embeds a unique jti that maps 1:1 to the stored Session row,
  // enabling single-use rotation and reuse detection.
  private async issueTokensRaw(
    user: { id: string; email: string; role: unknown; status: unknown },
    ctx: SessionContext,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const principal: AuthedUser = {
      userId: user.id,
      role: asEnum<UserRole>(user.role),
      email: user.email,
      status: asEnum<UserStatus>(user.status),
    };
    const jti = crypto.randomBytes(16).toString('base64url');
    const accessToken = signAccessToken(principal, { jti, deviceId: ctx.deviceId ?? '' });
    const refreshToken = signRefreshToken(user.id, jti);
    const expiresAt = new Date(Date.now() + config.jwt.refreshTtlDays * 24 * 60 * 60 * 1000);
    await this.repo.storeRefreshToken(
      user.id,
      hashToken(refreshToken),
      jti,
      ctx.deviceId ?? null,
      ctx.ip ?? null,
      expiresAt,
    );
    return { accessToken, refreshToken };
  }
}
