import { Router } from 'express';
import { DiscoverService, IDiscoverService } from './discover.service';
import { DiscoverRepository } from './discover.repository';
import { DiscoverController } from './discover.controller';
import { discoverRoutes } from './discover.routes';
import { prisma } from '@config/prisma';

export function buildDiscoverModule(): Router {
  const repo = new DiscoverRepository(prisma);
  const service: IDiscoverService = new DiscoverService(repo);
  const controller = new DiscoverController(service);
  return discoverRoutes(controller, service);
}

export { DiscoverService, DiscoverRepository, DiscoverController };
export * from './discover.types';
export * from './discover.schema';
