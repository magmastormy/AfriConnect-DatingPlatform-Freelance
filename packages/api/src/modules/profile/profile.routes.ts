import { Router } from 'express';
import { ProfileController } from './profile.controller';
import { IProfileService } from './profile.service';
import { authorize } from '@config/middleware';

export function profileRoutes(controller: ProfileController, _service: IProfileService): Router {
  const router = Router();
  router.get('/me', authorize(), controller.getOwn);
  router.put('/me', authorize(), controller.upsert);
  router.put('/me/preferences', authorize(), controller.updatePreferences);
  router.put('/me/privacy', authorize(), controller.updatePrivacy);
  router.post('/me/photos', authorize(), controller.addPhoto);
  router.delete('/me/photos', authorize(), controller.removePhoto);
  router.post('/me/pause', authorize(), controller.pause);
  return router;
}
