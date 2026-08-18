import express, { Router } from 'express';
import { VettingController } from './vetting.controller';
import { IVettingService } from './vetting.service';
import { authorize } from '@config/middleware/auth';

export function vettingRoutes(controller: VettingController, _service: IVettingService): Router {
  const router = Router();

  // Start a KYC session for the signed-in member; returns a QR-able hosted URL.
  router.post('/smile/session', authorize(), controller.createSession);
  // Polled by the desktop to learn when the cross-device check has completed.
  router.get('/smile/status', authorize(), controller.status);
  // Testing-only phone simulator completion (no auth — see controller).
  router.post('/smile/sandbox/complete', controller.completeSandbox);
  // Provider callback: signature-verified, so it must see the raw bytes.
  router.post('/smile/webhook', express.raw({ type: 'application/json' }), controller.webhook);

  return router;
}
