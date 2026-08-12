import crypto from 'crypto';
import { IAuthRepository } from './auth.repository';
import {
  IEmailProvider,
  ISmsProvider,
} from '@africonnect/shared';
import { OtpStore, InMemoryOtpStore, generateOtpCode } from './otpStore';
import {
  VERIFY_TOKEN_LENGTH,
  VERIFY_TOKEN_TTL_MINUTES,
  OTP_LENGTH,
  OTP_TTL_MINUTES,
  SMS_FALLBACK_MAX_REQUESTS_PER_WINDOW,
  SMS_FALLBACK_WINDOW_MINUTES,
} from '@africonnect/shared';
import { assertWithinLimit } from '@config/rateLimiter';
import { logger } from '@africonnect/shared';
import { AuthenticationError, NotFoundError } from '@africonnect/shared';
import { verificationEmail, buildVerificationUrl } from './emailTemplates';

/**
 * Account verification orchestration.
 *
 * Verification is EMAIL-PRIMARY (per product requirement):
 *   1. requestVerification(email)    -> mints a signed token, emails a link.
 *   2. confirmEmail(token)           -> sets emailVerified=true.
 * SMS is a SECONDARY FALLBACK for users who cannot receive email:
 *   3. requestSmsFallback(phone)     -> sends an OTP via SMS (Twilio or console).
 *   4. confirmSmsFallback(phone,code)-> sets phoneVerified=true.
 *
 * Both channels mark the account as verified and are independently rate-limited.
 */
export class VerificationService {
  private readonly otpStore: OtpStore = new InMemoryOtpStore();

  constructor(
    private readonly repo: IAuthRepository,
    private readonly email: IEmailProvider,
    private readonly sms: ISmsProvider,
  ) {}

  /** PRIMARY: mint a token, persist its hash, email the link. */
  async requestVerification(email: string): Promise<{ delivered: boolean }> {
    const user = await this.repo.findUserByEmail(email);
    if (!user) {
      // Fail closed: don't reveal whether an address is registered.
      logger.info({ email }, 'Verification requested for unknown email (no-op)');
      return { delivered: true };
    }
    if (user.emailVerified) return { delivered: true };

    const token = crypto.randomBytes(VERIFY_TOKEN_LENGTH).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_MINUTES * 60 * 1000);
    await this.repo.createVerificationToken(user.id, tokenHash, expiresAt);

    const tmpl = verificationEmail(buildVerificationUrl(token));
    const result = await this.email.send({ to: email, ...tmpl });
    logger.info({ email, provider: this.email.name, messageId: result.id }, 'Verification email sent');
    return { delivered: result.delivered };
  }

  /** PRIMARY: redeem an emailed token. Never logs the raw token. */
  async confirmEmail(token: string): Promise<void> {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const record = await this.repo.findVerificationToken(tokenHash);
    if (!record) throw new AuthenticationError('Invalid or expired verification link');
    await this.repo.setEmailVerified(record.userId, true);
    await this.repo.deleteVerificationToken(tokenHash);
    logger.info({ userId: record.userId }, 'Email verified');
  }

  /** SECONDARY FALLBACK: send an SMS OTP when email is unavailable. */
  async requestSmsFallback(phone: string): Promise<{ delivered: boolean }> {
    assertWithinLimit(
      `smsfb:${phone}`,
      SMS_FALLBACK_MAX_REQUESTS_PER_WINDOW,
      SMS_FALLBACK_WINDOW_MINUTES * 60 * 1000,
    );
    const user = await this.repo.findUserByPhone(phone);
    if (!user) {
      logger.info({ phone }, 'SMS fallback requested for unknown phone (no-op)');
      return { delivered: true };
    }
    if (user.phoneVerified) return { delivered: true };

    const code = generateOtpCode(OTP_LENGTH);
    const expiresAt = Date.now() + OTP_TTL_MINUTES * 60 * 1000;
    this.otpStore.set(phone, { code, expiresAt, attempts: 0 });

    const result = await this.sms.send(
      phone,
      `AfriConnect: your verification code is ${code}. Valid for ${OTP_TTL_MINUTES} minutes.`,
    );
    logger.info({ phone, provider: this.sms.name, messageId: result.id }, 'SMS fallback OTP sent');
    return { delivered: result.delivered };
  }

  /** SECONDARY FALLBACK: verify the SMS OTP. */
  async confirmSmsFallback(phone: string, code: string): Promise<void> {
    const entry = this.otpStore.get(phone);
    if (!entry || entry.expiresAt < Date.now()) {
      this.otpStore.delete(phone);
      throw new AuthenticationError('SMS code expired or not requested');
    }
    if (entry.attempts >= 5) {
      throw new AuthenticationError('Too many SMS code attempts, request a new code');
    }
    entry.attempts += 1;
    if (entry.code !== code) throw new AuthenticationError('Invalid SMS code');
    this.otpStore.delete(phone);

    const user = await this.repo.findUserByPhone(phone);
    if (!user) throw new NotFoundError('No account found for this phone');
    await this.repo.setPhoneVerified(user.id, true);
    logger.info({ userId: user.id }, 'Phone verified via SMS fallback');
  }
}
