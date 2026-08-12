import { Router } from 'express';
import { NotificationService, INotificationService } from './notification.service';
import { NotificationRepository } from './notification.repository';
import { NotificationController } from './notification.controller';
import { notificationRoutes } from './notification.routes';
import { prisma } from '@config/prisma';

export function buildNotificationModule(): Router {
  const repo = new NotificationRepository(prisma);
  const service: INotificationService = new NotificationService(repo);
  const controller = new NotificationController(service);
  return notificationRoutes(controller, service);
}

export { NotificationService, NotificationRepository, NotificationController };
export * from './notification.types';
export * from './notification.schema';
