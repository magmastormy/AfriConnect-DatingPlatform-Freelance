import { Router } from 'express';
import { MatchController } from './match.controller';
import { IMatchService } from './match.service';
import { authorize, requireVetted } from '@config/middleware';

/**
 * Matching is a members-only surface. Every route requires both a session
 * (authorize) and an approved vetting decision (requireVetted) — an
 * unverified account can hold a profile but cannot see or act on candidates.
 */
export function matchRoutes(controller: MatchController, _service: IMatchService): Router {
  const router = Router();
  const vetted = [authorize(), requireVetted()];

  router.get('/daily', vetted, controller.daily);
  // Default, engine-driven discovery surface. GET /matches/discover runs the
  // full hybrid MatchingEngine (content + CF + diversity + business rules) and
  // is the canonical way clients should fetch candidate cards.
  router.get('/discover', vetted, controller.discover);
  // Alias that additionally supports an explicit ?radiusKm= override. Backed by
  // the same engine as /discover.
  router.get('/recommend', vetted, controller.recommend);
  // Preview is reachable by any authenticated member (no vetting gate) so that
  // unverified accounts can sample a capped set of seeded members.
  router.get('/preview', [authorize()], controller.preview);
  router.get('/mutual', vetted, controller.mutual);
  router.post('/:id/like', vetted, controller.like);
  router.post('/:id/pass', vetted, controller.pass);
  router.post('/:id/superlike', vetted, controller.superlike);
  return router;
}
