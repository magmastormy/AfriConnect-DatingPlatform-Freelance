import { Router } from 'express';
import { ProfileService, IProfileService } from './profile.service';
import { ProfileRepository } from './profile.repository';
import { ProfileController } from './profile.controller';
import { profileRoutes } from './profile.routes';
import { prisma } from '@config/prisma';
import { createMediaStorage } from '@config/providers';

export function buildProfileModule(): Router {
  const repo = new ProfileRepository(prisma);
  const service: IProfileService = new ProfileService(repo, createMediaStorage());
  const controller = new ProfileController(service);
  return profileRoutes(controller, service);
}

export { ProfileService, ProfileRepository, ProfileController };
export * from './profile.types';
export * from './profile.schema';
