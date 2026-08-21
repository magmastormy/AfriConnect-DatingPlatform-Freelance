import { Router } from 'express';
import { AdminService, IAdminService } from './admin.service';
import { AdminRepository } from './admin.repository';
import { AdminController } from './admin.controller';
import { adminRoutes } from './admin.routes';
import { prisma } from '@config/prisma';
import { ApplicationService } from '@modules/application/application.service';
import { ApplicationRepository } from '@modules/application/application.repository';
import { EventService } from '@modules/event/event.service';
import { EventRepository } from '@modules/event/event.repository';
import { BillingService } from '@modules/billing/billing.service';
import { BillingRepository } from '@modules/billing/billing.repository';
import { NotificationService } from '@modules/notification/notification.service';
import { NotificationRepository } from '@modules/notification/notification.repository';
import { createMediaStorage } from '@config/providers';

export function buildAdminModule(): Router {
  const repo = new AdminRepository(prisma);
  const notificationService = new NotificationService(new NotificationRepository(prisma));
  const applicationService = new ApplicationService(
    new ApplicationRepository(prisma),
    notificationService,
  );
  const eventService = new EventService(new EventRepository(prisma));
  const billingService = new BillingService(new BillingRepository(prisma), notificationService);
  const storage = createMediaStorage();

  const service: IAdminService = new AdminService(
    repo,
    applicationService,
    eventService,
    billingService,
    notificationService,
    storage,
  );
  const controller = new AdminController(service);
  return adminRoutes(controller, service);
}

export { AdminService, AdminRepository, AdminController };
export * from './admin.types';
