import { Router } from 'express';
import { AuthController } from './auth.controller';
import { IAuthService } from './auth.service';
import { authorize } from '@config/middleware';
import { deviceBinding, requireDeviceBinding } from '@config/middleware/device';

export function authRoutes(controller: AuthController, _service: IAuthService): Router {
  const router = Router();
  router.use(deviceBinding()); // attach req.deviceId on every auth route
  router.post('/request-otp', controller.requestOtp);
  router.post('/verify-otp', controller.verifyOtp);
  router.post('/refresh', requireDeviceBinding(), controller.refresh);
  router.post('/logout', controller.logout);
  router.post('/clerk/exchange', controller.clerkExchange);
  // Verification: email is the primary channel, SMS is the secondary fallback.
  router.post('/verification/request', controller.requestVerification);
  router.post('/verification/confirm', controller.confirmEmail);
  router.post('/verification/sms/request', controller.requestSmsFallback);
  router.post('/verification/sms/confirm', controller.confirmSmsFallback);
  router.get('/me', authorize(), controller.me);
  return router;
}
