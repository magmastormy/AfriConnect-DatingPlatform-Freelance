import { Router } from 'express';
import { DiscoverController } from './discover.controller';
import { IDiscoverService } from './discover.service';
import { authorize, requireVetted } from '@config/middleware';

/**
 * Discovery routes.
 *
 * /discover/nearby is the WeChat-Nearby surface: it reveals opted-in members in
 * the caller's district. It requires an approved vetting decision (requireVetted)
 * AND an active Premium subscription (enforced in the service). The premium gate
 * is the authoritative server-side check — the web only mirrors it for UI.
 */
export function discoverRoutes(controller: DiscoverController, _service: IDiscoverService): Router {
  const router = Router();
  const vetted = [authorize(), requireVetted()];

  router.get('/nearby', ...vetted, controller.nearby);
  return router;
}
