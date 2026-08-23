import { Router } from 'express';
import { UploadController } from './upload.controller';
import { IUploadService } from './upload.service';
import { rateLimitMiddleware } from '@config/middleware';
import { RATE_LIMIT_UPLOAD_MAX, RATE_LIMIT_UPLOAD_WINDOW_MS } from '@africonnect/shared';

export function uploadRoutes(controller: UploadController, _service: IUploadService): Router {
  const router = Router();
  // Upload tier: 3 req / hour / user (Clause 3.4) — prevents storage abuse
  router.post(
    '/',
    rateLimitMiddleware(RATE_LIMIT_UPLOAD_MAX, RATE_LIMIT_UPLOAD_WINDOW_MS),
    ...controller.upload,
  );
  return router;
}
