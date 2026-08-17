import { Router } from 'express';
import { AnalyticsService, IAnalyticsService } from './analytics.service';
import { AnalyticsRepository } from './analytics.repository';
import { AnalyticsController } from './analytics.controller';
import { analyticsRoutes } from './analytics.routes';
import { prisma } from '@config/prisma';

/** Compose the analytics module router. */
export function buildAnalyticsModule(): Router {
  const repo = new AnalyticsRepository(prisma);
  const service: IAnalyticsService = new AnalyticsService(repo);
  const controller = new AnalyticsController(service);
  return analyticsRoutes(controller, service);
}

export { AnalyticsService, AnalyticsController, AnalyticsRepository };
export * from './analytics.types';
export * from './analytics.schema';
