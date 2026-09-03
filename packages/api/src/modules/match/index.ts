import { Router } from 'express';
import { MatchService, IMatchService } from './match.service';
import { MatchRepository } from './match.repository';
import { MatchController } from './match.controller';
import { matchRoutes } from './match.routes';
import { prisma } from '@config/prisma';
import { ProfileRepository } from '@modules/profile/profile.repository';
import { NotificationService } from '@modules/notification/notification.service';
import { NotificationRepository } from '@modules/notification/notification.repository';
import { createMediaStorage } from '@config/providers';

/**
 * Builds the MatchService with its notification dependency wired in so that
 * superlikes and mutual matches fan out in-app alerts. Shared by the match
 * router and any consumer that needs `isMutual` (e.g. the chat module guards
 * conversation creation on a mutual match). Media storage signs the photo
 * URLs on every card before they leave the API (private R2 buckets 403
 * anonymous GETs).
 */
export function buildMatchService(): IMatchService {
  const repo = new MatchRepository(prisma);
  const profileRepo = new ProfileRepository(prisma);
  const notify = new NotificationService(new NotificationRepository(prisma));
  return new MatchService(repo, profileRepo, notify, createMediaStorage());
}

export function buildMatchModule(): Router {
  const service = buildMatchService();
  const controller = new MatchController(service);
  return matchRoutes(controller, service);
}

export { MatchService, MatchRepository, MatchController };
export type { IMatchService };
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
