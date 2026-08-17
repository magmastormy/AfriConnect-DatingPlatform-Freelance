import { Router } from 'express';
import { UploadService, IUploadService } from './upload.service';
import { UploadController } from './upload.controller';
import { uploadRoutes } from './upload.routes';
import { createMediaStorage } from '@config/providers';

/** Compose the upload module router. */
export function buildUploadModule(): Router {
  const storage = createMediaStorage();
  const service: IUploadService = new UploadService(storage);
  const controller = new UploadController(service);
  return uploadRoutes(controller, service);
}

export { UploadService, UploadController };
export * from './upload.types';
export * from './upload.schema';
