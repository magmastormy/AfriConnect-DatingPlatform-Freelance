import { Router } from 'express';
import { SettingsService, ISettingsService } from './settings.service';
import { SettingsRepository, getPlatformSettings } from './settings.repository';
import { SettingsController } from './settings.controller';
import { settingsRoutes } from './settings.routes';
import { prisma } from '@config/prisma';

export function buildSettingsModule(): Router {
  const repo = new SettingsRepository(prisma);
  const service: ISettingsService = new SettingsService(repo);
  const controller = new SettingsController(service);
  return settingsRoutes(controller, service);
}

export { getPlatformSettings };
export * from './settings.types';
