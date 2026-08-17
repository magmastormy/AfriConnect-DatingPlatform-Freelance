import { Router } from 'express';
import { ProfileController } from './profile.controller';
import { IProfileService } from './profile.service';
import { authorize, requireVetted } from '@config/middleware';

/**
 * Profile routes are intentionally NOT behind requireVetted().
 *
 * Account-first onboarding means a member creates their profile before they are
 * vetted, and must be able to keep tuning it while their application is under
 * review (that is exactly what reviewers look at). Only the social surfaces —
 * matching, messaging, event attendance — require an approved decision.
 */
export function profileRoutes(controller: ProfileController, _service: IProfileService): Router {
  const router = Router();
  router.get('/me', authorize(), controller.getOwn);
  router.put('/me', authorize(), controller.upsert);
  router.put('/me/preferences', authorize(), controller.updatePreferences);
  router.put('/me/privacy', authorize(), controller.updatePrivacy);
  router.post('/me/photos', authorize(), controller.addPhoto);
  router.delete('/me/photos', authorize(), controller.removePhoto);
  router.put('/me/nearby', authorize(), controller.updateNearby);
  router.post('/me/pause', authorize(), controller.pause);
  // Must be registered AFTER the /me/* routes above so /me is not swallowed.
  router.get('/:userId', authorize(), requireVetted(), controller.getRedNote);
  return router;
}
