import { Router } from 'express';
import { ApplicationService, IApplicationService } from './application.service';
import { ApplicationRepository } from './application.repository';
import { ApplicationController } from './application.controller';
import { applicationRoutes } from './application.routes';
import { NotificationService } from '@modules/notification/notification.service';
import { NotificationRepository } from '@modules/notification/notification.repository';
import { prisma } from '@config/prisma';
import { createMediaStorage } from '@config/providers';

export function buildApplicationModule(): Router {
  const repo = new ApplicationRepository(prisma);
  const notifications = new NotificationService(new NotificationRepository(prisma));
  const service: IApplicationService = new ApplicationService(
    repo,
    notifications,
    createMediaStorage(),
  );
  const controller = new ApplicationController(service);
  return applicationRoutes(controller, service);
}

export { ApplicationService, ApplicationRepository, ApplicationController };
export * from './application.types';
export * from './application.schema';
