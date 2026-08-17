import { Router } from 'express';
import { ApplicationController } from './application.controller';
import { IApplicationService } from './application.service';
import { AdminScope, SCOPE_ROLES } from '@africonnect/shared';
import { authorize } from '@config/middleware';

export function applicationRoutes(
  controller: ApplicationController,
  _service: IApplicationService,
): Router {
  const router = Router();

  // Vetting is account-first: the caller must already hold an account, so the
  // application can be bound to their user id and they can track its status.
  router.post('/', authorize(), controller.submit);
  router.get('/me', authorize(), controller.getOwn);

  // Vetting review is owned by the vetting scope, not by generic admins
  // (AGENTS.md: split admin roles via SCOPE_ROLES).
  router.get('/admin', authorize(...SCOPE_ROLES[AdminScope.Vetting]), controller.listAdmin);
  router.put('/admin/:id', authorize(...SCOPE_ROLES[AdminScope.Vetting]), controller.review);

  return router;
}
