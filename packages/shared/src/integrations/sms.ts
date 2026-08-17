import { logger } from '../logger';
import { InternalError } from '../errors/AppError';

/**
 * Outbound SMS. SMS is the SECONDARY verification fallback for AfriConnect:
 * it is only used when a user cannot receive the primary email verification
 * link. (See AGENTS verification reframe — email-primary, SMS-fallback.)
 *
 * Provider strategy (mirrors Stripe's dev-fallback pattern):
 *   - TwilioSmsProvider -> real send through Twilio (instantiate with creds)
 *   - ConsoleSmsProvider -> logs the body to stdout when no credentials present
 */
export interface ISmsProvider {
  readonly name: string;
  send(to: string, body: string): Promise<{ id: string; delivered: boolean }>;
}

/** Logs the SMS body to stdout. Used in dev and when Twilio is unset. */
export class ConsoleSmsProvider implements ISmsProvider {
  readonly name = 'console';

  async send(to: string, body: string): Promise<{ id: string; delivered: boolean }> {
    const id = `console_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    logger.info({ provider: this.name, to, messageId: id }, 'SMS dispatched (console)');
    logger.debug({ body }, 'SMS body (console)');
    return { id, delivered: true };
  }
}

/** Twilio-backed SMS. Fails loudly if credentials are missing. */
export class TwilioSmsProvider implements ISmsProvider {
  readonly name = 'twilio';
  private client: {
    messages: {
      create: (args: Record<string, unknown>) => Promise<{ sid?: string }>;
    };
  };

  constructor(
    accountSid: string,
    authToken: string,
    private readonly fromNumber: string,
  ) {
    if (!accountSid || !authToken || !fromNumber) {
      throw new InternalError(
        'TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_FROM_NUMBER are required for the twilio sms provider',
      );
    }
    // Lazy require so the dependency is only needed when this provider is active.
    const twilio = require('twilio');
    this.client = twilio(accountSid, authToken) as typeof this.client;
  }

  async send(to: string, body: string): Promise<{ id: string; delivered: boolean }> {
    try {
      const result = await this.client.messages.create({
        to,
        from: this.fromNumber,
        body,
      });
      return { id: result.sid ?? 'unknown', delivered: true };
    } catch (err) {
      logger.error({ err, to }, 'Twilio SMS send failed');
      throw new InternalError('Failed to send SMS', { to });
    }
  }
}
