import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AdminAuthRepository } from './adminAuth.repository';
import { AdminAuthService } from './adminAuth.service';
import { AdminAuthController } from './adminAuth.controller';
import { adminAuthRoutes } from './adminAuth.routes';

export function buildAdminAuthModule(prisma?: PrismaClient): Router {
  const client = prisma ?? new PrismaClient();
  const repo = new AdminAuthRepository(client);
  const service = new AdminAuthService(repo);
  const controller = new AdminAuthController(service);
  return adminAuthRoutes(controller, service);
}

export { AdminAuthService } from './adminAuth.service';
export { AdminAuthRepository } from './adminAuth.repository';
