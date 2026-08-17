import { Router } from 'express';
import { SettingsController } from './settings.controller';
import { ISettingsService } from './settings.service';
import { authorize } from '@config/middleware';
import { UserRole } from '@africonnect/shared';

// Any administrator may read/manage the platform gating configuration (CRM).
const ALL_ADMINS = [
  UserRole.Admin,
  UserRole.AdminVetting,
  UserRole.AdminEvents,
  UserRole.AdminBilling,
  UserRole.AdminSupport,
  UserRole.AdminContent,
  UserRole.SuperAdmin,
];

export function settingsRoutes(controller: SettingsController, _service: ISettingsService): Router {
  const router = Router();
  router.get('/', authorize(...ALL_ADMINS), controller.getSettings);
  router.put('/', authorize(...ALL_ADMINS), controller.updateSettings);
  return router;
}
