import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { logger } from '../logger';
import { InternalError } from '../errors/AppError';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * Media (image) storage. Replaces the earlier S3 placeholder. AfriConnect now
 * uses Cloudinary for user-uploaded media (profile photos, chat images).
 *
 * Provider strategy (mirrors Stripe's dev-fallback pattern):
 *   - CloudinaryMediaStorage -> real upload via Cloudinary (instantiate w/ URL)
 *   - LocalMediaStorage -> writes to ./uploads and serves via the static
 *     /uploads route, so local dev needs no Cloudinary account.
 *   - CloudflareR2MediaStorage -> AWS S3-compatible Cloudflare R2 storage
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

/**
 * Cloudflare R2-backed media storage using AWS SDK S3 client.
 * R2 is AWS S3-compatible, so we use @aws-sdk/client-s3 with R2-specific endpoint.
 *
 * URL format: https://{accountId}.r2.cloudflarestorage.com/{bucket}/{key}
 * With custom CDN: https://{cdnDomain}/{key}
 */
export class CloudflareR2MediaStorage implements IMediaStorage {
  readonly name = 'r2';

  private client: S3Client;
  private bucket: string;
  private accountId: string;
  private cdnDomain?: string;

  /**
   * Constructor with configuration validation.
   * @throws InternalError if required config is missing or S3 client initialization fails
   */
  constructor(config: {
    accessKeyId: string;
    secretAccessKey: string;
    accountId: string;
    bucketName: string;
    cdnDomain?: string; // Optional custom CDN domain
  }) {
    // Validate all required config is present
    const missing: string[] = [];
    if (!config.accessKeyId) missing.push('R2_ACCESS_KEY_ID');
    if (!config.secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
    if (!config.accountId) missing.push('R2_ACCOUNT_ID');
    if (!config.bucketName) missing.push('R2_BUCKET_NAME');

    if (missing.length > 0) {
      throw new InternalError(
        `Cloudflare R2 media provider requires: ${missing.join(', ')}. ` +
          `Set all required environment variables before starting.`,
      );
    }

    // Initialize S3Client with R2 endpoint
    try {
      this.client = new S3Client({
        region: 'auto', // R2 uses 'auto' for region
        endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: config.accessKeyId,
          secretAccessKey: config.secretAccessKey,
        },
      });
      this.bucket = config.bucketName;
      this.accountId = config.accountId;
      this.cdnDomain = config.cdnDomain;
    } catch (err) {
      logger.error({ err }, 'CloudflareR2MediaStorage: S3 client initialization failed');
      throw new InternalError('Failed to initialize Cloudflare R2 client', {
        accountId: config.accountId,
      });
    }
  }

  /**
   * Generate public URL for uploaded object.
   * Uses custom CDN domain if provided, otherwise default R2 URL format.
   */
  private generateUrl(key: string): string {
    if (this.cdnDomain) {
      return `https://${this.cdnDomain}/${key}`;
    }
    return `https://${this.accountId}.r2.cloudflarestorage.com/${this.bucket}/${key}`;
  }

  /**
   * Upload buffer to Cloudflare R2 bucket.
   * Object key format: {folder}/{timestamp}-{random}.{ext}
   */
  async upload(buffer: Buffer, ext: string, folder: string): Promise<UploadResult> {
    const safeFolder = folder.replace(/[^a-z0-9_-]/gi, '');
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const key = `${safeFolder}/${id}.${ext}`;

    // Determine content type based on extension
    const contentType = this.getContentType(ext);

    try {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read', // Make the object publicly accessible
      });

      await this.client.send(command);

      const url = this.generateUrl(key);
      const publicId = key;

      logger.info({ key, url, folder }, 'CloudflareR2MediaStorage: upload successful');

      return { url, publicId };
    } catch (err) {
      logger.error({ err, key, folder }, 'CloudflareR2MediaStorage: upload failed');
      throw new InternalError('Failed to store media in Cloudflare R2', { folder, key });
    }
  }

  /**
   * Remove object from Cloudflare R2 bucket.
   * Handles 404 (not found) gracefully - logs warning but doesn't throw error.
   */
  async remove(publicId: string): Promise<void> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: publicId,
      });

      await this.client.send(command);
      logger.info({ key: publicId }, 'CloudflareR2MediaStorage: remove successful');
    } catch (err) {
      // Check if it's a 404 (not found) error - handled gracefully
      const s3Error = err as { code?: string };
      if (s3Error.code === 'NotFound' || s3Error.code === 'NoSuchKey') {
        logger.warn(
          { key: publicId },
          'CloudflareR2MediaStorage: remove failed - object not found (ignored)',
        );
        return;
      }

      logger.warn({ err, key: publicId }, 'CloudflareR2MediaStorage: remove failed (ignored)');
    }
  }

  /**
   * Get content type based on file extension.
   */
  private getContentType(ext: string): string {
    const contentTypes: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      pdf: 'application/pdf',
    };

    return contentTypes[ext.toLowerCase()] || 'application/octet-stream';
  }
}
