import { Router } from 'express';
import { MatchService, IMatchService } from './match.service';
import { MatchRepository } from './match.repository';
import { MatchController } from './match.controller';
import { matchRoutes } from './match.routes';
import { prisma } from '@config/prisma';
import { ProfileRepository } from '@modules/profile/profile.repository';

export function buildMatchModule(): Router {
  const repo = new MatchRepository(prisma);
  const profileRepo = new ProfileRepository(prisma);
  const service: IMatchService = new MatchService(repo, profileRepo);
  const controller = new MatchController(service);
  return matchRoutes(controller, service);
}

export { MatchService, MatchRepository, MatchController };
export * from './match.types';
export * from './match.schema';
export * from './scoring';
export * from './algorithms.types';
export * from './similarity';
export * from './geo';
export * from './contentBased';
export * from './collaborative';
export * from './popularity';
export * from './diversity';
export * from './coldStart';
export * from './fairness';
export * from './features';
export { MatchingEngine, buildDefaultConfig } from './engine';
