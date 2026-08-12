import { Router } from 'express';
import { MatchController } from './match.controller';
import { IMatchService } from './match.service';
import { authorize } from '@config/middleware';

export function matchRoutes(controller: MatchController, _service: IMatchService): Router {
  const router = Router();
  router.get('/daily', authorize(), controller.daily);
  router.get('/discover', authorize(), controller.discover);
  router.get('/mutual', authorize(), controller.mutual);
  router.post('/:id/like', authorize(), controller.like);
  router.post('/:id/pass', authorize(), controller.pass);
  router.post('/:id/superlike', authorize(), controller.superlike);
  return router;
}
