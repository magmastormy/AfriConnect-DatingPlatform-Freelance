import { z } from 'zod';
import { SubscriptionPlan } from '@africonnect/shared';

export const createCheckoutSchema = z.object({
  plan: z.nativeEnum(SubscriptionPlan),
  successUrl: z.string().url(),
  cancelUrl: z.string().url(),
});

export type CreateCheckoutDTO = z.infer<typeof createCheckoutSchema>;
