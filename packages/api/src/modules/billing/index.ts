import { Router } from 'express';
import { BillingService, IBillingService } from './billing.service';
import { BillingRepository } from './billing.repository';
import { BillingController } from './billing.controller';
import { billingRoutes } from './billing.routes';
import { prisma } from '@config/prisma';

export function buildBillingModule(): Router {
  const repo = new BillingRepository(prisma);
  const service: IBillingService = new BillingService(repo);
  const controller = new BillingController(service);
  return billingRoutes(controller, service);
}

export { BillingService, BillingRepository, BillingController };
export * from './billing.types';
export * from './billing.schema';
