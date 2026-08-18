import crypto from 'crypto';
import { prisma } from '@config/prisma';
import { logger } from '@africonnect/shared';

/**
 * Records a provider webhook event id. Returns true if this is the first time
 * we have seen it (process the side effect); false if it was already recorded
 * (a duplicate redelivery — skip it). The (provider, eventId) unique constraint
 * plus INSERT ... ON CONFLICT DO NOTHING makes the check atomic across the
 * horizontal fleet, so two instances handling the same redelivered event cannot
 * both apply it. Uses raw SQL so no Prisma client regeneration is required.
 */
export async function recordWebhookEvent(provider: string, eventId: string): Promise<boolean> {
  if (!eventId) return true; // nothing to dedupe on — let the caller process (best effort)
  const id = crypto.randomUUID();
  try {
    const result = await prisma.$executeRaw`
      INSERT INTO "webhook_events" ("id", "provider", "eventId", "status", "createdAt")
      VALUES (${id}, ${provider}, ${eventId}, 'processed', now())
      ON CONFLICT ("provider", "eventId") DO NOTHING;
    `;
    const affected = typeof result === 'number' ? result : 1;
    if (affected === 0) {
      logger.info({ provider, eventId }, 'Webhook event already processed — skipping (idempotent)');
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ err, provider, eventId }, 'recordWebhookEvent failed');
    throw err;
  }
}
