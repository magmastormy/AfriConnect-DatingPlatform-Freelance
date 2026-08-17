import { Router } from 'express';
import { BillingService, IBillingService } from './billing.service';
import { BillingRepository } from './billing.repository';
import { BillingController } from './billing.controller';
import { billingRoutes } from './billing.routes';
import { NotificationService } from '@modules/notification/notification.service';
import { NotificationRepository } from '@modules/notification/notification.repository';
import { prisma } from '@config/prisma';

export function buildBillingModule(): Router {
  const repo = new BillingRepository(prisma);
  const notifications = new NotificationService(new NotificationRepository(prisma));
  const service: IBillingService = new BillingService(repo, notifications);
  const controller = new BillingController(service);
  return billingRoutes(controller, service);
}

export { BillingService, BillingRepository, BillingController };
export * from './billing.types';
export * from './billing.schema';
