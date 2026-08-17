import { Router } from 'express';
import { AnalyticsController } from './analytics.controller';
import { IAnalyticsService } from './analytics.service';
import { authorize } from '@config/middleware';

export function analyticsRoutes(
  controller: AnalyticsController,
  _service: IAnalyticsService,
): Router {
  const router = Router();
  router.post('/profile-view', ...controller.track);
  router.get('/me', authorize(), controller.me);
  return router;
}
