import { Router } from 'express';
import { AdminAuthController } from './adminAuth.controller';
import { IAdminAuthService } from './adminAuth.service';
import { authorize } from '@config/middleware';
import { UserRole } from '@africonnect/shared';

export function adminAuthRoutes(controller: AdminAuthController, _service: IAdminAuthService): Router {
  const router = Router();

  // Public — no auth. Rate-limited inside service (5/15min per email + 20/15min per IP)
  router.post('/login', controller.login);
  router.post('/bootstrap', controller.bootstrap);
  router.post('/refresh', controller.refresh);
  router.post('/logout', controller.logout);

  // Authenticated — returns current admin identity (for AdminAuthProvider bootstrap)
  router.get('/me', authorize(UserRole.Admin, UserRole.AdminVetting, UserRole.AdminEvents, UserRole.AdminBilling, UserRole.AdminSupport, UserRole.AdminContent, UserRole.SuperAdmin), controller.me);

  return router;
}
