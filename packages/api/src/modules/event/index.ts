import { Router } from 'express';
import { EventService, IEventService } from './event.service';
import { EventRepository } from './event.repository';
import { EventController } from './event.controller';
import { eventRoutes } from './event.routes';
import { prisma } from '@config/prisma';

export function buildEventModule(): Router {
  const repo = new EventRepository(prisma);
  const service: IEventService = new EventService(repo);
  const controller = new EventController(service);
  return eventRoutes(controller, service);
}

export { EventService, EventRepository, EventController };
export * from './event.types';
export * from './event.schema';
