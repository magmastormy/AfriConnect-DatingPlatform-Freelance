import { Router } from 'express';
import { UploadController } from './upload.controller';
import { IUploadService } from './upload.service';

export function uploadRoutes(controller: UploadController, _service: IUploadService): Router {
  const router = Router();
  router.post('/', ...controller.upload);
  return router;
}
