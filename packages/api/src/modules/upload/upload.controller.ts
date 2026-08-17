import { Request, Response } from 'express';
import multer from 'multer';
import { asyncHandler, success, ValidationError } from '@africonnect/shared';
import { assertWithinLimit } from '@config/rateLimiter';
import { authorize } from '@config/middleware';
import {
  RATE_LIMIT_UPLOAD_MAX,
  RATE_LIMIT_UPLOAD_WINDOW_MS,
  UPLOAD_MAX_BYTES,
} from '@africonnect/shared';
import { IUploadService } from './upload.service';
import { uploadQuerySchema } from './upload.schema';
import { UploadFolder } from './upload.types';

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'application/pdf'];

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.includes(file.mimetype)) cb(null, true);
    else cb(new ValidationError('Unsupported file type. Allowed: JPG, PNG, PDF.'));
  },
});

export class UploadController {
  constructor(private readonly service: IUploadService) {}

  /**
   * POST /upload — authenticated, rate-limited (3/hr/user). Accepts a single
   * multipart `file` and an optional `?folder` (`vetting`|`photos`|`proof`).
   * Magic-byte validation happens in the service; only then is the file sent to
   * the configured media storage. Returns `{ url, publicId }`.
   */
  upload = [
    authorize(),
    upload.single('file'),
    asyncHandler(async (req: Request, res: Response) => {
      if (!req.user) throw new ValidationError('Unauthenticated');
      assertWithinLimit(
        `upload:${req.user.userId}`,
        RATE_LIMIT_UPLOAD_MAX,
        RATE_LIMIT_UPLOAD_WINDOW_MS,
      );

      const { folder } = uploadQuerySchema.parse(req.query);
      const file = req.file;
      if (!file) throw new ValidationError('No file provided');

      const result = await this.service.upload(file.buffer, folder as UploadFolder);
      res.status(201).json(success(result));
    }),
  ];
}
