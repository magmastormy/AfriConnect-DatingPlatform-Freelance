import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';
import { createHash, createHmac } from 'crypto';
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

// ── SigV4 helpers (used by CloudflareR2MediaStorage.getSignedUrl) ────────────
// Implemented inline so we don't pull @aws-sdk/s3-request-presigner into the
// shared bundle — Node's crypto is built-in and the algorithm is short.
function sha256Hex(s: string): string {
  return createHash('sha256').update(s, 'utf8').digest('hex');
}
function uriEncode(s: string): string {
  return encodeURIComponent(s).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase(),
  );
}
function hmac(key: Buffer | string, data: string): Buffer {
  return createHmac('sha256', key).update(data, 'utf8').digest();
}
function deriveSigningKey(secret: string, date: string, region: string, service: string): Buffer {
  const kDate = hmac('AWS4' + secret, date);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

export interface IMediaStorage {
  readonly name: string;
  upload(buffer: Buffer, ext: string, folder: string): Promise<UploadResult>;
  remove(publicId: string): Promise<void>;
  /**
   * Returns a URL the browser can use to GET the object. For private buckets
   * (R2 with no public access) this must be a presigned URL with a finite TTL —
   * otherwise the browser gets the storage provider's XML auth error.
   * For local/Cloudinary the original public URL is fine.
   */
  getSignedUrl(publicId: string, ttlSeconds: number): Promise<string>;
  /**
   * Hostnames this storage is authoritative for. The read-time signer only
   * rewrites URLs whose host is owned here (the R2 default host, a custom R2
   * CDN domain). External URLs — seed/demo portraits on randomuser.me or
   * picsum.photos, Cloudinary URLs, anything else we don't host — must pass
   * through to the browser untouched: signing one would mint a presigned URL
   * for a key that doesn't exist in the bucket, and R2 replies with its XML
   * 403 instead of the image.
   */
  assetHosts?(): readonly string[];
}

/** TTL for presigned media URLs handed to browsers (1 hour). */
export const SIGNED_MEDIA_URL_TTL_SECONDS = 3600;

/**
 * Converts a stored media URL into a URL the browser can actually GET.
 *
 * R2 buckets are kept private (vet documents contain PII — POPIA), so an
 * unsigned browser GET against `…r2.cloudflarestorage.com/<bucket>/<key>`
 * replies with R2's XML `<Error><Code>InvalidArgument</Code><Message>
 * Authorization…</Message></Error>` and the <img> renders a broken-image icon.
 * We mint a short-lived SigV4 presigned URL on every read boundary instead.
 *
 * - Local dev storage (`/uploads/...`): served statically by the API → unchanged.
 * - Cloudinary: public secure_url → unchanged.
 * - External hosts we don't own (seed portraits on randomuser.me/picsum.photos,
 *   any third-party URL) → unchanged. Signing these would mint a presigned URL
 *   for a key that doesn't exist in the bucket and the <img> would 403.
 * - R2 default host (`…r2.cloudflarestorage.com/<bucket>/<key>`): extract the
 *   key (path after the bucket segment) and sign.
 * - R2 custom CDN host (`https://<cdn>/<key>`, listed by storage.assetHosts()):
 *   the full path is the key.
 *
 * Already-signed URLs are safe to re-sign: the object key is taken from the
 * path only, so stale query params are discarded and a fresh signature is
 * minted. Never throws — on failure the original URL is returned so a signing
 * hiccup never blanks out an image.
 */
export async function toBrowserMediaUrl(
  url: string | null | undefined,
  storage: IMediaStorage,
  ttlSeconds: number = SIGNED_MEDIA_URL_TTL_SECONDS,
): Promise<string | null> {
  if (!url) return null;
  // Local storage: served by the API's static `/uploads` route. Leave untouched.
  if (url.startsWith('/uploads/')) return url;
  // Cloudinary: public secure_url. Leave untouched.
  if (url.includes('res.cloudinary.com')) return url;
  try {
    const u = new URL(url);
    // Absolute local-storage URL (LocalMediaStorage given an API origin) —
    // already browser-loadable via the API's static /uploads route.
    if (u.pathname.startsWith('/uploads/')) return url;
    // Only presign objects our storage actually serves. Anything hosted
    // elsewhere (seed/demo content, third-party images) passes through.
    const ownedHosts = storage.assetHosts?.() ?? [];
    const isOwned =
      u.hostname.endsWith('.r2.cloudflarestorage.com') || ownedHosts.includes(u.hostname);
    if (!isOwned) return url;
    const segments = u.pathname.replace(/^\/+/, '').split('/');
    // Default R2 host nests the bucket as the first path segment; a custom CDN
    // host does not.
    const key = u.hostname.endsWith('.r2.cloudflarestorage.com')
      ? segments.slice(1).join('/')
      : segments.join('/');
    if (!key) return url;
    return await storage.getSignedUrl(key, ttlSeconds);
  } catch (err) {
    // Relative or otherwise unparseable URL — pass through unchanged.
    logger.warn({ err, url }, 'toBrowserMediaUrl: signing skipped, returning original URL');
    return url;
  }
}

/** Maps a list of stored URLs through {@link toBrowserMediaUrl}, dropping nulls. */
export async function toBrowserMediaUrls(
  urls: Array<string | null | undefined>,
  storage: IMediaStorage,
  ttlSeconds: number = SIGNED_MEDIA_URL_TTL_SECONDS,
): Promise<string[]> {
  const signed = await Promise.all(
    urls.map((u) => toBrowserMediaUrl(u, storage, ttlSeconds)),
  );
  return signed.filter((u): u is string => Boolean(u));
}

const LOCAL_UPLOAD_DIR = path.join(process.cwd(), 'uploads');

/**
 * Writes files to ./uploads and returns a public URL.
 * If `apiBaseUrl` is provided, the URL is absolute (https://host/uploads/...)
 * so it works from any frontend domain without a proxy rewrite.
 * Otherwise returns the relative `/uploads/<folder>/<file>` path.
 */
export class LocalMediaStorage implements IMediaStorage {
  readonly name = 'local';
  private readonly apiBaseUrl?: string;

  constructor(apiBaseUrl?: string) {
    this.apiBaseUrl = apiBaseUrl?.replace(/\/+$/, '');
  }

  async upload(buffer: Buffer, ext: string, folder: string): Promise<UploadResult> {
    const safeFolder = folder.replace(/[^a-z0-9_-]/gi, '');
    const dir = path.join(LOCAL_UPLOAD_DIR, safeFolder);
    await mkdir(dir, { recursive: true });
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const file = `${id}.${ext}`;
    await writeFile(path.join(dir, file), buffer);
    // publicId is the path relative to the uploads dir (used by remove()).
    const publicId = `${safeFolder}/${file}`;
    const relativeUrl = `/uploads/${safeFolder}/${file}`;
    const url = this.apiBaseUrl
      ? `${this.apiBaseUrl}${relativeUrl}`
      : relativeUrl;
    return { url, publicId };
  }

  async remove(publicId: string): Promise<void> {
    try {
      await unlink(path.join(LOCAL_UPLOAD_DIR, publicId));
    } catch (err) {
      logger.warn({ err, publicId }, 'LocalMediaStorage: remove failed (ignored)');
    }
  }

  // Local files are served by the static `/uploads` route on the API — the
  // URL is already browser-loadable without signing. Prefer absolute URL when
  // the API origin is known so callers from other domains can reach it.
  async getSignedUrl(publicId: string, _ttlSeconds: number): Promise<string> {
    const relative = `/uploads/${publicId.replace(/^\/+/, '')}`;
    return this.apiBaseUrl ? `${this.apiBaseUrl}${relative}` : relative;
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

  // Cloudinary secure_url assets are already publicly readable — pass through.
  async getSignedUrl(publicId: string, _ttlSeconds: number): Promise<string> {
    // publicId here is the full secure_url we stored on upload. If callers pass
    // a raw key instead, we can't reliably reconstruct the URL without the
    // cloud_name, so they should pass the stored URL through.
    return publicId;
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
   * Hosts this storage can serve objects from. Used by the read-time signer to
   * tell owned R2/CDN URLs apart from external (seed/third-party) URLs, which
   * must never be presigned.
   */
  assetHosts(): readonly string[] {
    return [this.cdnDomain, `${this.accountId}.r2.cloudflarestorage.com`].filter(
      (h): h is string => Boolean(h),
    );
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
   * Generate a SigV4-presigned GET URL valid for `ttlSeconds`.
   *
   * R2 bucket policy: objects are private unless the bucket itself has public
   * access enabled — which the project deliberately does NOT do, since vet
   * documents contain PII (POPIA). An unsigned browser GET returns R2's XML
   * `<Error><Code>InvalidArgument</Code><Message>Authorization</Message></Error>`.
   * The fix: mint a per-request signed URL here. Implementation is intentionally
   * inline (Node's crypto is built-in) so we don't need @aws-sdk/s3-request-presigner.
   */
  async getSignedUrl(publicId: string, ttlSeconds: number): Promise<string> {
    const key = publicId.replace(/^\/+/, '');
    const host = this.cdnDomain ? this.cdnDomain : `${this.accountId}.r2.cloudflarestorage.com`;
    const proto = 'https';
    const canonicalUri = this.cdnDomain ? `/${key}` : `/${this.bucket}/${key}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const credentialScope = `${dateStamp}/auto/s3/aws4_request`;
    const algorithm = 'AWS4-HMAC-SHA256';
    const service = 's3';

    // We need the credentials. Reach into the S3Client to get them — the SDK
    // exposes them via the resolved provider's `getCredentials` if needed, but
    // simpler: we cached them on construction. Pull them back out by re-reading
    // from the resolved config. Fallback: ask the client.
    const creds = await this.resolveCredentials();
    const accessKeyId = creds.accessKeyId;
    const secretAccessKey = creds.secretAccessKey;

    const credential = `${accessKeyId}/${credentialScope}`;
    const signedHeaders = 'host';
    const expires = Math.max(1, Math.min(604800, Math.floor(ttlSeconds))); // R2 max 7 days.

    const params = new URLSearchParams();
    params.set('X-Amz-Algorithm', algorithm);
    params.set('X-Amz-Credential', credential);
    params.set('X-Amz-Date', amzDate);
    params.set('X-Amz-Expires', String(expires));
    params.set('X-Amz-SignedHeaders', signedHeaders);

    const canonicalHeaders = `host:${host}\n`;
    const payloadHash = 'UNSIGNED-PAYLOAD';

    // Canonical query string is the alphabetically-sorted params.
    const canonicalQueryString = [...params.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${uriEncode(k)}=${uriEncode(v)}`)
      .join('&');

    const canonicalRequest = [
      'GET',
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join('\n');

    const hashedCanonicalRequest = sha256Hex(canonicalRequest);
    const stringToSign = [algorithm, amzDate, credentialScope, hashedCanonicalRequest].join('\n');

    const signingKey = deriveSigningKey(secretAccessKey, dateStamp, 'auto', service);
    const signature = createHmac('sha256', signingKey).update(stringToSign).digest('hex');

    params.set('X-Amz-Signature', signature);

    return `${proto}://${host}${canonicalUri}?${params.toString()}`;
  }

  /**
   * Extracts credentials from the S3Client's internal middleware stack.
   * The SDK lazily resolves providers (incl. default chains), so we resolve
   * once at first use and memoize.
   */
  private resolvedCreds: { accessKeyId: string; secretAccessKey: string } | null = null;
  private async resolveCredentials(): Promise<{ accessKeyId: string; secretAccessKey: string }> {
    if (this.resolvedCreds) return this.resolvedCreds;
    // The S3Client.config.credentials may be a provider; await it to get a static pair.
    const creds = (this.client as unknown as { config: { credentials: unknown } }).config
      .credentials as
      | { accessKeyId?: string; secretAccessKey?: string }
      | (() => Promise<{ accessKeyId?: string; secretAccessKey?: string }>);
    let resolved: { accessKeyId?: string; secretAccessKey?: string } | undefined;
    if (typeof creds === 'function') {
      resolved = await creds();
    } else {
      resolved = creds;
    }
    if (!resolved?.accessKeyId || !resolved?.secretAccessKey) {
      throw new InternalError('R2 credentials could not be resolved for presigning');
    }
    this.resolvedCreds = {
      accessKeyId: resolved.accessKeyId,
      secretAccessKey: resolved.secretAccessKey,
    };
    return this.resolvedCreds;
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
