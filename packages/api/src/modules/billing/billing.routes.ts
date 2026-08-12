import { Router } from 'express';
import express from 'express';
import { BillingController } from './billing.controller';
import { IBillingService } from './billing.service';
import { authorize } from '@config/middleware';

export function billingRoutes(controller: BillingController, _service: IBillingService): Router {
  const router = Router();
  router.post('/checkout-session', authorize(), controller.checkout);
  router.get('/subscription', authorize(), controller.subscription);
  // Public webhook: Stripe signature verification replaces auth. Raw body is
  // required for HMAC verification, so bypass the global JSON parser here.
  router.post('/webhook', express.raw({ type: '*/*' }), controller.webhook);
  return router;
}
