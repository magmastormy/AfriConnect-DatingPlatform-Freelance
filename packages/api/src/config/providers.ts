import { config } from './index';
import {
  ConsoleEmailProvider,
  ResendEmailProvider,
  IEmailProvider,
  ConsoleSmsProvider,
  TwilioSmsProvider,
  ISmsProvider,
  LocalMediaStorage,
  CloudinaryMediaStorage,
  CloudflareR2MediaStorage,
  IMediaStorage,
} from '@africonnect/shared';

/**
 * Provider factories. Each resolves the configured provider from env and falls
 * back to a dev-safe local/console implementation when credentials are absent --
 * mirroring the existing Stripe dev-fallback pattern (AGENTS verification reframe:
 * Resend email is PRIMARY, Twilio SMS is SECONDARY fallback, Cloudinary is media).
 */

export function createEmailProvider(): IEmailProvider {
  if (config.emailProvider === 'resend') {
    return new ResendEmailProvider(config.resendApiKey, config.emailFrom);
  }
  return new ConsoleEmailProvider();
}

export function createSmsProvider(): ISmsProvider {
  if (config.smsProvider === 'twilio') {
    return new TwilioSmsProvider(
      config.twilioAccountSid,
      config.twilioAuthToken,
      config.twilioFromNumber,
    );
  }
  return new ConsoleSmsProvider();
}

export function createMediaStorage(): IMediaStorage {
  if (config.mediaProvider === 'cloudinary') {
    return new CloudinaryMediaStorage(config.cloudinaryUrl);
  }

  if (config.mediaProvider === 'r2') {
    return new CloudflareR2MediaStorage({
      accessKeyId: config.r2AccessKeyId,
      secretAccessKey: config.r2SecretAccessKey,
      accountId: config.r2AccountId,
      bucketName: config.r2BucketName,
      cdnDomain: config.r2CdnDomain || undefined,
    });
  }

  return new LocalMediaStorage();
}
