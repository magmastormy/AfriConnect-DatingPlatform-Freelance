import { logger } from '../logger';
import { InternalError } from '../errors/AppError';

/**
 * Outbound transactional email. Email is the PRIMARY verification channel for
 * AfriConnect (see AGENTS verification reframe): sign-up and re-verification
 * send a link via this provider. SMS is a secondary fallback only.
 *
 * Provider strategy (mirrors Stripe's dev-fallback pattern):
 *   - ResendEmailProvider -> real send through Resend (instantiate with a key)
 *   - ConsoleEmailProvider -> renders to stdout when no credentials are present
 *
 * The Resend SDK is imported lazily inside the provider so the package is only
 * required when Resend is actually used (no hard network dependency at startup).
 */
export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface IEmailProvider {
  /** Human-readable provider id, used in logs/health. */
  readonly name: string;
  send(message: EmailMessage): Promise<{ id: string; delivered: boolean }>;
}

/** Logs the rendered message to stdout. Used in dev and when Resend is unset. */
export class ConsoleEmailProvider implements IEmailProvider {
  readonly name = 'console';

  async send(message: EmailMessage): Promise<{ id: string; delivered: boolean }> {
    const id = `console_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    logger.info(
      { provider: this.name, to: message.to, subject: message.subject, messageId: id },
      'Email dispatched (console)',
    );
    // The link/text is intentionally logged so local verification is clickable.
    logger.debug({ text: message.text }, 'Email body (console)');
    return { id, delivered: true };
  }
}

/** Resend-backed email. Fails loudly if the API key is missing. */
export class ResendEmailProvider implements IEmailProvider {
  readonly name = 'resend';
  private client: { emails: { send: (args: Record<string, unknown>) => Promise<{ id?: string }> } };

  constructor(apiKey: string, private readonly from: string) {
    if (!apiKey) {
      throw new InternalError('RESEND_API_KEY is required for the resend email provider');
    }
    // Lazy require so the dependency is only needed when this provider is active.
    const Resend = require('resend').Resend;
    this.client = new Resend(apiKey) as typeof this.client;
  }

  async send(message: EmailMessage): Promise<{ id: string; delivered: boolean }> {
    try {
      const result = await this.client.emails.send({
        from: this.from,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
      return { id: result.id ?? 'unknown', delivered: true };
    } catch (err) {
      logger.error({ err, to: message.to }, 'Resend email send failed');
      throw new InternalError('Failed to send email', { to: message.to });
    }
  }
}
