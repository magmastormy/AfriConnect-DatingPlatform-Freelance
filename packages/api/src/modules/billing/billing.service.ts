import Stripe from 'stripe';
import { IBillingRepository } from './billing.repository';
import { CreateCheckoutInput, SubscriptionView, SubscriptionAdminView } from './billing.types';
import { config } from '@config/index';
import {
  SubscriptionStatus,
  SubscriptionPlan,
  asEnum,
  AdminScope,
  NotificationChannel,
} from '@africonnect/shared';
import { logger } from '@africonnect/shared';
import { InternalError } from '@africonnect/shared';
import { INotificationService } from '@modules/notification/notification.service';
import { recordWebhookEvent } from '@webhooks/dedupe';

const PLAN_TO_PRICE: Partial<Record<SubscriptionPlan, string>> = {
  // Map each plan to its Stripe Price ID. Populated from the Stripe dashboard.
  premium: process.env.STRIPE_PRICE_PREMIUM || '',
  platinum: process.env.STRIPE_PRICE_PLATINUM || '',
};

/**
 * Stripe billing integration. When STRIPE_SECRET_KEY is absent (local dev) we
 * activate the plan immediately and return a mock success URL so the flow is
 * fully exercisable without external calls. With a key, a real hosted Checkout
 * Session is created and the subscription lifecycle is driven by webhooks.
 */
export interface IBillingService {
  createCheckout(
    userId: string,
    input: CreateCheckoutInput,
  ): Promise<{ url: string; mock: boolean }>;
  getSubscription(userId: string): Promise<SubscriptionView | null>;
  handleWebhook(rawBody: string, signature: string | undefined): Promise<void>;
  listForAdmin(status?: unknown): Promise<SubscriptionAdminView[]>;
  cancelSubscription(userId: string, atPeriodEnd: boolean): Promise<void>;
  grantSubscription(userId: string, plan: SubscriptionPlan, months: number): Promise<void>;
}

function getStripe(): Stripe | null {
  if (!config.stripeSecretKey) return null;
  // Live keys are rejected at boot (config/index.ts), so any key present here is
  // a test key. This guard is belt-and-suspenders against a future refactor.
  if (!config.stripeSecretKey.startsWith('sk_test_')) {
    throw new InternalError('Stripe live mode is disabled for AfriConnect MVP');
  }
  return new Stripe(config.stripeSecretKey, {
    apiVersion: '2024-06-20',
    typescript: true,
  });
}

export class BillingService implements IBillingService {
  constructor(
    private readonly repo: IBillingRepository,
    private readonly notifications: INotificationService,
  ) {}

  async createCheckout(
    userId: string,
    input: CreateCheckoutInput,
  ): Promise<{ url: string; mock: boolean }> {
    const stripe = getStripe();
    if (!stripe) {
      logger.warn(
        { userId, plan: input.plan },
        'Stripe not configured — activating plan in dev mode',
      );
      await this.repo.upsertSubscription({
        userId,
        plan: input.plan,
        status: SubscriptionStatus.Active,
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000),
      });
      await this.notifyPayment(userId, input.plan);
      return { url: input.successUrl, mock: true };
    }

    const priceId = PLAN_TO_PRICE[input.plan];
    if (!priceId) {
      throw new InternalError(`No Stripe price configured for plan ${input.plan}`);
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: userId,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
      subscription_data: {
        metadata: { userId, plan: input.plan },
      },
      metadata: { userId, plan: input.plan },
    });

    return { url: session.url ?? input.successUrl, mock: false };
  }

  async getSubscription(userId: string): Promise<SubscriptionView | null> {
    const sub = await this.repo.getByUser(userId);
    if (!sub) return null;
    return {
      plan: asEnum<SubscriptionView['plan']>(sub.plan),
      status: asEnum<SubscriptionView['status']>(sub.status),
      currentPeriodEnd: sub.currentPeriodEnd,
    };
  }

  async listForAdmin(status?: unknown): Promise<SubscriptionAdminView[]> {
    const subs = await this.repo.listForAdmin(status);
    return subs.map((s) => ({
      userId: s.userId,
      email: s.user?.email ?? '',
      plan: asEnum<SubscriptionAdminView['plan']>(s.plan),
      status: asEnum<SubscriptionAdminView['status']>(s.status),
      cancelAtPeriodEnd: s.cancelAtPeriodEnd,
      currentPeriodEnd: s.currentPeriodEnd,
    }));
  }

  async cancelSubscription(userId: string, atPeriodEnd: boolean): Promise<void> {
    // When Stripe is configured, mirror the change on the remote subscription.
    const stripe = getStripe();
    if (stripe) {
      const sub = await this.repo.getByUser(userId);
      if (sub?.stripeSubscriptionId) {
        await stripe.subscriptions.update(sub.stripeSubscriptionId, {
          cancel_at_period_end: atPeriodEnd,
        });
      }
    }
    // at_period_end keeps the plan active until it lapses; immediate cancel ends it now.
    await this.repo.updateStatus(userId, {
      status: atPeriodEnd ? SubscriptionStatus.Active : SubscriptionStatus.Cancelled,
      cancelAtPeriodEnd: atPeriodEnd,
    });
  }

  async grantSubscription(userId: string, plan: SubscriptionPlan, months: number): Promise<void> {
    const end = new Date();
    end.setMonth(end.getMonth() + months);
    await this.repo.grant(userId, { plan, currentPeriodEnd: end });
    logger.info({ userId, plan, months }, 'Subscription granted by admin');
  }

  /** Dispatches a billing alert without failing the payment reconciliation. */
  private async notifyPayment(userId: string, plan: SubscriptionPlan): Promise<void> {
    try {
      await this.notifications.notifyAdmins(
        {
          userId,
          type: 'billing.payment',
          title: 'New subscription payment',
          body: `${plan} subscription activated for ${userId}`,
          channel: NotificationChannel.InApp,
          data: { userId, plan },
        },
        [AdminScope.Billing],
      );
    } catch (err) {
      logger.warn({ err, userId }, 'Failed to dispatch payment notification');
    }
  }

  async handleWebhook(rawBody: string, signature: string | undefined): Promise<void> {
    const stripe = getStripe();
    if (!stripe) return; // dev mode without Stripe: nothing to reconcile

    if (!config.stripeWebhookSecret) {
      throw new InternalError('STRIPE_WEBHOOK_SECRET is required to verify webhooks');
    }
    if (!signature) {
      throw new InternalError('Missing Stripe-Signature header');
    }

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, signature, config.stripeWebhookSecret);
    } catch (err) {
      logger.error({ err }, 'Stripe webhook signature verification failed');
      throw new InternalError('Invalid webhook signature');
    }

    // Idempotency: a redelivered event (Stripe retries) must not double-apply a
    // side effect (double grant / double notify). The WebhookEvent ledger makes
    // this safe across the horizontal fleet.
    const isNew = await recordWebhookEvent('stripe', event.id);
    if (!isNew) return;

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.client_reference_id ?? session.metadata?.userId;
        const plan = (session.metadata?.plan as SubscriptionPlan) ?? undefined;
        if (userId && plan) {
          await this.repo.upsertSubscription({
            userId,
            plan,
            status: SubscriptionStatus.Active,
            stripeCustomerId: session.customer as string,
            stripeSubscriptionId: session.subscription as string,
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          });
          await this.notifyPayment(userId, plan);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const userId = sub.metadata?.userId;
        if (userId) {
          const status =
            event.type === 'customer.subscription.deleted'
              ? SubscriptionStatus.Cancelled
              : sub.status === 'active'
                ? SubscriptionStatus.Active
                : sub.status === 'trialing'
                  ? SubscriptionStatus.Trialing
                  : SubscriptionStatus.PastDue;
          await this.repo.updateStatus(userId, {
            status,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            currentPeriodEnd: sub.current_period_end
              ? new Date(sub.current_period_end * 1000)
              : null,
          });
        }
        break;
      }
      default:
        logger.debug({ type: event.type }, 'Unhandled Stripe event type');
    }
  }
}
