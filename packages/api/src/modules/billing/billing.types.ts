import { SubscriptionPlan, SubscriptionStatus } from '@africonnect/shared';

export interface CreateCheckoutInput {
  plan: SubscriptionPlan;
  successUrl: string;
  cancelUrl: string;
}

export interface SubscriptionView {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: Date | null;
}

export interface SubscriptionAdminView {
  userId: string;
  email: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
}
