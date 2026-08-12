import { Router } from 'express';
import { ApplicationService, IApplicationService } from './application.service';
import { ApplicationRepository } from './application.repository';
import { ApplicationController } from './application.controller';
import { applicationRoutes } from './application.routes';
import { prisma } from '@config/prisma';

export function buildApplicationModule(): Router {
  const repo = new ApplicationRepository(prisma);
  const service: IApplicationService = new ApplicationService(repo);
  const controller = new ApplicationController(service);
  return applicationRoutes(controller, service);
}

export { ApplicationService, ApplicationRepository, ApplicationController };
export * from './application.types';
export * from './application.schema';
