import { Router } from 'express';
import { AuthService, IAuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { AuthController } from './auth.controller';
import { authRoutes } from './auth.routes';
import { VerificationService } from './verification.service';
import { prisma } from '@config/prisma';
import { createEmailProvider, createSmsProvider } from '@config/providers';

export function buildAuthModule(): Router {
  const repo = new AuthRepository(prisma);
  const service: IAuthService = new AuthService(repo);
  // Verification is email-primary (Resend), SMS is the console/Twilio fallback.
  const verification = new VerificationService(repo, createEmailProvider(), createSmsProvider());
  const controller = new AuthController(service, verification);
  return authRoutes(controller, service);
}

export { AuthService, AuthRepository, AuthController };
export * from './auth.types';
export * from './auth.schema';
