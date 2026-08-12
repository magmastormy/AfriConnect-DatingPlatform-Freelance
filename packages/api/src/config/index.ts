import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT) || 4000,
  apiBaseUrl: process.env.API_BASE_URL || 'http://localhost:4000',
  webBaseUrl: process.env.WEB_BASE_URL || 'http://localhost:3000',
  logLevel: process.env.LOG_LEVEL || 'info',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  // Obfuscated API mount segment. In production set API_MOUNT_PATH to a long,
  // unguessable random string (e.g. `openssl rand -hex 16`). This hides the
  // versioned surface from path enumeration. Falls back to "api" for local dev.
  apiMountPath: (process.env.API_MOUNT_PATH || 'api').replace(/^\/+|\/+$/g, ''),
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    accessTtlMinutes: Number(process.env.JWT_ACCESS_TTL_MINUTES) || 15,
    refreshTtlDays: Number(process.env.JWT_REFRESH_TTL_DAYS) || 7,
  },
  piiMasterKey: process.env.PII_MASTER_KEY,
  otp: {
    length: Number(process.env.OTP_LENGTH) || 6,
    ttlMinutes: Number(process.env.OTP_TTL_MINUTES) || 10,
  },
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:4000')
    .split(',')
    .map((o) => o.trim()),
  // ── Billing (Stripe, TEST MODE ONLY) ──────────────────────────────────────
  // AfriConnect must never transact in live mode during the MVP. A live key
  // (sk_live_) is rejected at boot by the billing service so a misconfigured
  // deploy cannot charge real cards. Only sk_test_ keys are accepted.
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  // ── Email (Resend, primary verification channel) ─────────────────────────
  // EMAIL_PROVIDER=resend uses Resend; anything else (including "console") logs
  // the rendered message to stdout so the flow is exercisable without creds.
  emailProvider: (process.env.EMAIL_PROVIDER || 'console').toLowerCase(),
  resendApiKey: process.env.RESEND_API_KEY || '',
  emailFrom: process.env.EMAIL_FROM || 'AfriConnect <no-reply@afri-connect.co.za>',
  // ── Media storage (Cloudinary) ────────────────────────────────────────────
  // MEDIA_PROVIDER=cloudinary uses Cloudinary; "local" (default) writes to
  // ./uploads and serves them via the static /uploads route so local dev needs
  // no external account.
  mediaProvider: (process.env.MEDIA_PROVIDER || 'local').toLowerCase(),
  cloudinaryUrl: process.env.CLOUDINARY_URL || '',
  // ── SMS (Twilio, secondary verification fallback) ────────────────────────
  // SMS_PROVIDER=twilio uses Twilio; "console" (default) logs the OTP. SMS is a
  // fallback only — email verification remains the primary path.
  smsProvider: (process.env.SMS_PROVIDER || 'console').toLowerCase(),
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER || '',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@afri-connect.co.za',
  adminSetupToken: process.env.ADMIN_SETUP_TOKEN || '',
} as const;

// ─── Stripe test-mode enforcement (billing must never run live) ────────────
// A configured Stripe key must be a test key. Live keys are blocked at startup
// so a misconfiguration can never charge real cards on the MVP.
if (config.stripeSecretKey && !config.stripeSecretKey.startsWith('sk_test_')) {
  throw new Error(
    'STRIPE_SECRET_KEY must be a test key (sk_test_...). ' +
      'Live mode is disabled for AfriConnect MVP. Refusing to boot with a live key.',
  );
}

export type AppConfig = typeof config;
