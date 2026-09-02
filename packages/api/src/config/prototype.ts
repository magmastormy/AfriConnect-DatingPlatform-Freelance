import type { Subscription } from '@prisma/client';
import { prisma } from '@config/prisma';
import { config } from '@config/index';
import {
  logger,
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
  UserStatus,
} from '@africonnect/shared';

/**
 * Prototype (proof-of-concept) shortcuts.
 *
 * This build is handed to stakeholders as a working demo, so a handful of
 * real-world gates are relaxed while the member still *experiences* the whole
 * flow:
 *
 *   1. Every account gets an active Premium subscription at signup, so nobody
 *      has to check out to explore paid features.
 *   2. Submitting vetting documents approves the member immediately — the
 *      review queue is never worked, because in a prototype there is no
 *      reviewer.
 *
 * The two are deliberately kept separate: Premium is a *billing* tier (a
 * Subscription row), while "vetted" is driven by `role` + `status`. That
 * separation is what lets a member be Premium from signup yet still have to
 * walk the vetting flow to reach the dating surface.
 *
 * Every helper here no-ops when `config.prototypeMode` is false, so setting
 * PROTOTYPE_MODE=false restores the genuine gated behaviour with no other edits.
 */

/** How long a prototype subscription runs before it would look expired. */
const PROTOTYPE_PERIOD_DAYS = 365;

function periodEnd(): Date {
  const end = new Date();
  end.setDate(end.getDate() + PROTOTYPE_PERIOD_DAYS);
  return end;
}

/**
 * Grant an active Premium subscription. Idempotent — safe to call on every
 * signup and login, because it upserts rather than inserting. Only the billing
 * tier is touched; vetting remains gated on role + status.
 */
export async function ensurePrototypePremium(userId: string): Promise<void> {
  if (!config.prototypeMode) return;
  try {
    await prisma.subscription.upsert({
      where: { userId },
      create: {
        userId,
        plan: SubscriptionPlan.Premium as unknown as Subscription['plan'],
        status: SubscriptionStatus.Active as unknown as Subscription['status'],
        currentPeriodStart: new Date(),
        currentPeriodEnd: periodEnd(),
      },
      update: {
        plan: SubscriptionPlan.Premium as unknown as Subscription['plan'],
        status: SubscriptionStatus.Active as unknown as Subscription['status'],
        currentPeriodEnd: periodEnd(),
      },
    });
  } catch (error) {
    // A failed demo grant must never block a signup or a login.
    logger.warn({ error, userId }, 'Prototype: could not grant premium subscription');
  }
}

/**
 * Mark a member as fully vetted. Called when they submit their documents so the
 * flow is still visible end-to-end but no admin has to review anything.
 */
export async function autoApproveVetting(userId: string): Promise<void> {
  if (!config.prototypeMode) return;
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { role: UserRole.Premium, status: UserStatus.Active },
    });
    logger.info({ userId }, 'Prototype: auto-approved vetting submission');
  } catch (error) {
    logger.warn({ error, userId }, 'Prototype: could not auto-approve vetting');
  }
}
