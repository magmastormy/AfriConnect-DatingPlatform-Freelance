import { Router } from 'express';
import { ApplicationController } from './application.controller';
import { IApplicationService } from './application.service';
import { UserRole } from '@africonnect/shared';
import { authorize } from '@config/middleware';

export function applicationRoutes(
  controller: ApplicationController,
  _service: IApplicationService,
): Router {
  const router = Router();
  router.post('/', controller.submit);
  router.get('/me', authorize(), controller.getOwn);
  router.get('/admin', authorize(UserRole.Admin, UserRole.SuperAdmin), controller.listAdmin);
  router.put('/admin/:id', authorize(UserRole.Admin, UserRole.SuperAdmin), controller.review);
  return router;
}
