import dotenv from 'dotenv';
import path from 'path';

// ─── Environment loading ───────────────────────────────────────────────────
// Tests must be hermetic. The config validation suites assert that boot FAILS
// when a required variable is absent, so they delete keys from process.env and
// re-require this module. If dotenv ran here it would silently repopulate those
// keys from the developer's local .env, and the assertions would pass or fail
// depending on whose machine executed them (a real .env with MEDIA_PROVIDER=r2
// made every "throws when R2_* is missing" test fail). Under NODE_ENV=test the
// process.env supplied by the test is the single source of truth.
if (process.env.NODE_ENV !== 'test') {
  dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });
  dotenv.config();
}

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
  // ── Media storage (Cloudinary/R2) ──────────────────────────────────────────
  // MEDIA_PROVIDER=cloudinary uses Cloudinary; MEDIA_PROVIDER=r2 uses Cloudflare R2;
  // "local" (default) writes to ./uploads and serves them via the static /uploads route.
  mediaProvider: (process.env.MEDIA_PROVIDER || 'local').toLowerCase(),
  cloudinaryUrl: process.env.CLOUDINARY_URL || '',
  // ── Cloudflare R2 (alternative media storage) ─────────────────────────────
  // R2 is AWS S3-compatible object storage. Required when MEDIA_PROVIDER=r2.
  r2AccessKeyId: process.env.R2_ACCESS_KEY_ID || '',
  r2SecretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  r2AccountId: process.env.R2_ACCOUNT_ID || '',
  r2BucketName: process.env.R2_BUCKET_NAME || '',
  r2CdnDomain: process.env.R2_CDN_DOMAIN || '', // Optional custom CDN domain
  // ── SMS (Twilio, secondary verification fallback) ────────────────────────
  // SMS_PROVIDER=twilio uses Twilio; "console" (default) logs the OTP. SMS is a
  // fallback only — email verification remains the primary path.
  smsProvider: (process.env.SMS_PROVIDER || 'console').toLowerCase(),
  twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
  twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
  twilioFromNumber: process.env.TWILIO_FROM_NUMBER || '',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@afri-connect.co.za',
  adminSetupToken: process.env.ADMIN_SETUP_TOKEN || '',
  // ── KYC / identity verification (Smile ID) ────────────────────────────────
  // SMILE_SANDBOX defaults to true, so the whole cross-device flow runs in
  // testing with no credentials: the hosted URL points at our own /vetting/sandbox
  // simulator and the user flips to "verified" locally. Set SMILE_SANDBOX=false
  // (together with SMILE_PARTNER_ID + SMILE_API_KEY + SMILE_API_SECRET) to route
  // real jobs to Smile ID (ID + SmartSelfie liveness + government-DB checks).
  smile: {
    partnerId: process.env.SMILE_PARTNER_ID || '',
    apiKey: process.env.SMILE_API_KEY || '',
    apiSecret: process.env.SMILE_API_SECRET || '',
    sandbox: (process.env.SMILE_SANDBOX ?? 'true').toLowerCase() !== 'false',
  },
  // ── Prototype / proof-of-concept mode ────────────────────────────────────
  // Runs the product as a hands-off demo for stakeholder review. When enabled:
  //   • every account gets an active Premium subscription at signup
  //   • vetting submissions are auto-approved (no admin review queue to work)
  //   • the profile-completeness gate is relaxed so discovery works immediately
  // Defaults to ON because this build is the review prototype. Set
  // PROTOTYPE_MODE=false to restore the real gated production behaviour.
  prototypeMode: (process.env.PROTOTYPE_MODE ?? 'true').toLowerCase() !== 'false',
  // ── AI-powered messaging (prototype stand-in for real two-way chat) ──────
  // When enabled, the chat service answers the OTHER participant with an LLM
  // (driven by that member's profile) so messaging stays functional in the
  // demo even before a real mutual match exists. The relationship is still a
  // real 1:1 Conversation row; only the replies are generated. Set
  // AI_CHAT_ENABLED=false to restore the strict "mutual match only" behaviour.
  aiChatEnabled: (process.env.AI_CHAT_ENABLED ?? 'true').toLowerCase() !== 'false',
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

// ─── R2 provider validation (fail fast if R2 is enabled but config is missing)
if (config.mediaProvider === 'r2') {
  const missing: string[] = [];
  if (!config.r2AccessKeyId) missing.push('R2_ACCESS_KEY_ID');
  if (!config.r2SecretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
  if (!config.r2AccountId) missing.push('R2_ACCOUNT_ID');
  if (!config.r2BucketName) missing.push('R2_BUCKET_NAME');

  if (missing.length > 0) {
    throw new Error(
      `R2 media provider requires: ${missing.join(', ')}. ` +
        `Set all required environment variables before starting.`,
    );
  }
}
