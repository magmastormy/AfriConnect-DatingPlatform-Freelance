import { Router } from 'express';
import { AuthController } from './auth.controller';
import { IAuthService } from './auth.service';
import { authorize, rateLimitMiddleware } from '@config/middleware';
import { deviceBinding, requireDeviceBinding } from '@config/middleware/device';
import {
  RATE_LIMIT_AUTH_MAX,
  RATE_LIMIT_AUTH_WINDOW_MS,
} from '@africonnect/shared';

export function authRoutes(controller: AuthController, _service: IAuthService): Router {
  const router = Router();
  router.use(deviceBinding()); // attach req.deviceId on every auth route
  // Auth tier: 5 req / 15 min / IP (AGENTS.md Clause 3.4) — stricter than the general 100/min
  const authLimiter = rateLimitMiddleware(RATE_LIMIT_AUTH_MAX, RATE_LIMIT_AUTH_WINDOW_MS);
  router.post('/request-otp', authLimiter, controller.requestOtp);
  router.post('/verify-otp', authLimiter, controller.verifyOtp);
  router.post('/refresh', authLimiter, requireDeviceBinding(), controller.refresh);
  router.post('/logout', controller.logout);
  router.post('/clerk/exchange', controller.clerkExchange);
  // Verification: email is the primary channel, SMS is the secondary fallback.
  router.post('/verification/request', authLimiter, controller.requestVerification);
  router.post('/verification/confirm', authLimiter, controller.confirmEmail);
  router.post('/verification/sms/request', authLimiter, controller.requestSmsFallback);
  router.post('/verification/sms/confirm', authLimiter, controller.confirmSmsFallback);
  router.get('/me', authorize(), controller.me);
  return router;
}
