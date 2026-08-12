import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { logger } from '../logger';
import { InternalError } from '../errors/AppError';

/**
 * Media (image) storage. Replaces the earlier S3 placeholder. AfriConnect now
 * uses Cloudinary for user-uploaded media (profile photos, chat images).
 *
 * Provider strategy (mirrors Stripe's dev-fallback pattern):
 *   - CloudinaryMediaStorage -> real upload via Cloudinary (instantiate w/ URL)
 *   - LocalMediaStorage -> writes to ./uploads and serves via the static
 *     /uploads route, so local dev needs no Cloudinary account.
 */
export interface UploadResult {
  url: string;
  publicId: string;
}

export interface IMediaStorage {
  readonly name: string;
  upload(buffer: Buffer, ext: string, folder: string): Promise<UploadResult>;
  remove(publicId: string): Promise<void>;
}

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'uploads');

/** Writes files to ./uploads and returns a public /uploads/<file> URL. */
export class LocalMediaStorage implements IMediaStorage {
  readonly name = 'local';

  async upload(buffer: Buffer, ext: string, folder: string): Promise<UploadResult> {
    const safeFolder = folder.replace(/[^a-z0-9_-]/gi, '');
    const dir = path.join(LOCAL_UPLOAD_DIR, safeFolder);
    await mkdir(dir, { recursive: true });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const file = `${id}.${ext}`;
    await writeFile(path.join(dir, file), buffer);
    // url is the public path served by the static /uploads route; publicId is the
    // path relative to the uploads dir (used by remove()).
    const url = `/uploads/${safeFolder}/${file}`;
    const publicId = `${safeFolder}/${file}`;
    return { url, publicId };
  }

  async remove(publicId: string): Promise<void> {
    try {
      await unlink(path.join(LOCAL_UPLOAD_DIR, publicId));
    } catch (err) {
      logger.warn({ err, publicId }, 'LocalMediaStorage: remove failed (ignored)');
    }
  }
}

/** Cloudinary-backed media storage. Fails loudly if CLOUDINARY_URL is missing. */
export class CloudinaryMediaStorage implements IMediaStorage {
  readonly name = 'cloudinary';
  private client: {
    uploader: {
      upload: (
        data: string,
        opts: Record<string, unknown>,
      ) => Promise<{ secure_url: string; public_id: string }>;
      destroy: (publicId: string) => Promise<unknown>;
    };
  };

  constructor(cloudinaryUrl: string) {
    if (!cloudinaryUrl) {
      throw new InternalError('CLOUDINARY_URL is required for the cloudinary media provider');
    }
    // Lazy require so the dependency is only needed when this provider is active.
    const cloudinary = require('cloudinary').v2;
    cloudinary.config({ secure: true });
    this.client = cloudinary as typeof this.client;
  }

  async upload(buffer: Buffer, ext: string, folder: string): Promise<UploadResult> {
    try {
      // Cloudinary accepts a data URI; non-empty ext helps it infer the type.
      const dataUri = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${buffer.toString('base64')}`;
      const result = await this.client.uploader.upload(dataUri, {
        folder: `africonnect/${folder}`,
        overwrite: false,
        resource_type: 'image',
      });
      return { url: result.secure_url, publicId: result.public_id };
    } catch (err) {
      logger.error({ err, folder }, 'Cloudinary upload failed');
      throw new InternalError('Failed to store media', { folder });
    }
  }

  async remove(publicId: string): Promise<void> {
    try {
      await this.client.uploader.destroy(publicId);
    } catch (err) {
      logger.warn({ err, publicId }, 'Cloudinary remove failed (ignored)');
    }
  }
}
