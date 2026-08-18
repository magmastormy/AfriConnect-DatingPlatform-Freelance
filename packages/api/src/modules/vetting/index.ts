import { Router } from 'express';
import { VettingService, IVettingService } from './vetting.service';
import { VettingController } from './vetting.controller';
import { vettingRoutes } from './vetting.routes';
import { NotificationService } from '@modules/notification/notification.service';
import { NotificationRepository } from '@modules/notification/notification.repository';
import { prisma } from '@config/prisma';

export function buildVettingModule(): Router {
  const notifications = new NotificationService(new NotificationRepository(prisma));
  const service: IVettingService = new VettingService(notifications);
  const controller = new VettingController(service);
  return vettingRoutes(controller, service);
}

export { VettingService, VettingController };
export * from './vetting.types';
