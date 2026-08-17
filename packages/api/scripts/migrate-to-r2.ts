#!/usr/bin/env ts-node
/**
 * Migration script: Bulk migrate images from Cloudinary to Cloudflare R2
 *
 * Command: pnpm --filter @africonnect/api run migrate:r2
 *
 * Covers three storage locations:
 *   - profile_profiles.photos        (JSON array of { url, order, isPrimary })
 *   - vetting_applications.<doc>Url  (idDocument / degreeCertificate / selfie / proofOfWork)
 *   - chat_messages.imageUrl
 *
 * Process:
 * 1. Query database for all images with Cloudinary URLs
 * 2. For each Cloudinary URL:
 *    - Fetch image from Cloudinary
 *    - Upload to R2 using same folder structure
 *    - Update database record with new R2 URL
 *    - Log migration event with source/destination URLs
 * 3. Handle failures gracefully (log and continue with other images)
 *
 * Requirements:
 * - MIGRATION_CLOUDINARY_URL: Cloudinary URL for fetching existing images
 * - R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ACCOUNT_ID, R2_BUCKET_NAME: R2 credentials
 * - DATABASE_URL: Database connection string
 *
 * Usage:
 *   pnpm --filter @africonnect/api run migrate:r2
 */

import { config } from 'dotenv';
config();

import { Prisma, PrismaClient } from '@prisma/client';
import { logger } from '@africonnect/shared';
import { InternalError } from '@africonnect/shared/errors';

// ─────────────────────────────────────────────────────────────────────────────
// Database Client
// ─────────────────────────────────────────────────────────────────────────────
const prisma = new PrismaClient();

// ─────────────────────────────────────────────────────────────────────────────
// Migration State
// ─────────────────────────────────────────────────────────────────────────────
export interface MigrationStats {
  total: number;
  success: number;
  failed: number;
  skipped: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain Types
// ─────────────────────────────────────────────────────────────────────────────

/** Shape of a single entry inside the `Profile.photos` JSON column. */
export interface ProfilePhoto {
  url: string;
  order?: number;
  isPrimary?: boolean;
}

/**
 * Single-URL document columns that may hold a Cloudinary asset.
 *
 * IMPORTANT: these live on the `Application` model (table `vetting_applications`),
 * NOT on `Profile`. Earlier revisions of this script queried `profile_profiles`
 * for them, which fails outright because those columns do not exist there.
 */
type SingleUrlFieldName = 'idDocumentUrl' | 'degreeCertificateUrl' | 'selfieUrl' | 'proofOfWorkUrl';

/** All single-URL document columns, in the order they are scanned. */
const SINGLE_URL_FIELDS: readonly SingleUrlFieldName[] = [
  'idDocumentUrl',
  'degreeCertificateUrl',
  'selfieUrl',
  'proofOfWorkUrl',
] as const;

/** Row shape returned by the raw photo-discovery query. */
interface ProfilePhotosRow {
  userId: string;
  photos: Prisma.JsonValue;
}

/**
 * Row shape returned by the raw single-URL discovery queries.
 * Keyed by application `id` because `Application.userId` is nullable.
 */
interface ApplicationSingleUrlRow {
  id: string;
  url: string;
}

/** Row shape returned by the raw chat-image discovery query. */
interface MessageImageRow {
  id: string;
  imageUrl: string;
}

/** A single-URL migration candidate, normalised across the document columns. */
interface SingleUrlCandidate {
  applicationId: string;
  fieldName: SingleUrlFieldName;
  oldValue: string;
}

/**
 * Runtime type guard for a `Profile.photos` entry.
 *
 * The column is untyped JSON, so every entry must be validated before its
 * `url` is read. Entries that fail this check are preserved verbatim (never
 * dropped) so the migration can never destroy unrecognised data.
 */
export function isProfilePhoto(value: Prisma.JsonValue): value is Prisma.JsonObject & ProfilePhoto {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    typeof (value as Prisma.JsonObject).url === 'string'
  );
}

/** Normalise the raw `photos` JSON column into a list of JSON entries. */
export function toPhotoEntries(photos: Prisma.JsonValue): Prisma.JsonValue[] {
  if (photos === null || photos === undefined) return [];
  return Array.isArray(photos) ? photos : [photos];
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration Validation
// ─────────────────────────────────────────────────────────────────────────────
/** Environment variables the migration cannot run without. */
const REQUIRED_ENV_VARS = [
  'MIGRATION_CLOUDINARY_URL',
  'R2_ACCESS_KEY_ID',
  'R2_SECRET_ACCESS_KEY',
  'R2_ACCOUNT_ID',
  'R2_BUCKET_NAME',
  'DATABASE_URL',
] as const;

/**
 * Return the names of required env vars that are absent or empty.
 * Pure and exported so it can be unit-tested against the real implementation.
 */
export function findMissingConfig(env: Record<string, string | undefined> = process.env): string[] {
  return REQUIRED_ENV_VARS.filter((name) => !env[name]);
}

export function validateConfig(env: Record<string, string | undefined> = process.env): void {
  const missing = findMissingConfig(env);

  if (missing.length > 0) {
    throw new InternalError(
      `Migration requires: ${missing.join(', ')}. Set all required environment variables.`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloudinary URL Detection
// ─────────────────────────────────────────────────────────────────────────────
export function isCloudinaryUrl(url: string): boolean {
  return url.includes('cloudinary.com') || url.includes('res.cloudinary.com');
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloudinary URL Parsing
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Extract public ID from Cloudinary URL
 * Handles formats like:
 * - https://res.cloudinary.com/{account}/image/upload/v1234567890/folder/file.ext
 * - https://res.cloudinary.com/{account}/{folder}/file.ext
 */
export function extractPublicIdFromCloudinaryUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);

    // Cloudinary URL format: /{resource_type}/{type}/{version}/{folder}/{public_id}.{extension}
    // Example: /image/upload/v1234567890/africonnect/profile-photos/abc123.png

    const parts = urlObj.pathname.split('/').filter(Boolean);

    // Find the resource type (image, video, raw) and skip it
    const resourceTypeIndex = parts.indexOf('image');
    if (resourceTypeIndex === -1) return null;

    // Skip 'upload' or other types after resource type
    const typeIndex = resourceTypeIndex + 1;
    const versionIndex = typeIndex + 1;

    // Extract the folder and filename parts
    const pathParts = parts.slice(versionIndex + 1);

    // Remove extension from last part
    const lastPart = pathParts[pathParts.length - 1];
    const publicIdWithoutExt = lastPart.replace(/\.[^.]+$/, '');

    // Reconstruct public ID with folder structure
    const folderParts = pathParts.slice(0, pathParts.length - 1);
    folderParts.push(publicIdWithoutExt);

    return folderParts.join('/');
  } catch (error) {
    logger.warn({ url, error }, 'Failed to extract public ID from Cloudinary URL');
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cloudinary Fetcher Implementation
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Fetch image from Cloudinary using the Cloudinary SDK
 * @param url - The Cloudinary URL to fetch
 * @returns Buffer containing the image data
 */
async function fetchFromCloudinary(url: string): Promise<Buffer> {
  logger.info({ url }, 'Fetching image from Cloudinary');

  // Lazy require Cloudinary to avoid dependency issues when not active
  const cloudinary = require('cloudinary');

  const publicId = extractPublicIdFromCloudinaryUrl(url);
  if (!publicId) {
    throw new Error(`Could not parse Cloudinary URL: ${url}`);
  }

  try {
    // Cloudinary's download method fetches the raw image data
    // It requires the public ID and can use transformation parameters
    const result = await cloudinary.v2.api.download_resource(publicId, 'image');

    // The API returns a download URL, we need to fetch it
    if (result && result.url) {
      const response = await fetch(result.url);
      if (!response.ok) {
        throw new Error(`Failed to download image: ${response.statusText}`);
      }
      const buffer = Buffer.from(await response.arrayBuffer());
      logger.info({ publicId, size: buffer.length }, 'Successfully fetched image from Cloudinary');
      return buffer;
    }

    throw new Error('Cloudinary API did not return a download URL');
  } catch (error) {
    logger.error({ error, url, publicId }, 'Failed to fetch image from Cloudinary');
    throw new Error(
      `Failed to fetch image from Cloudinary: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// R2 Uploader Implementation
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Upload image buffer to Cloudflare R2 using CloudflareR2MediaStorage
 * Preserves folder structure from Cloudinary URL
 * @param buffer - Image data buffer
 * @param folder - R2 folder (profile-photos, chat-images, etc.)
 * @param filename - Filename with extension (e.g., "1234567890-abc123.png")
 * @returns Public URL of uploaded image
 */
async function uploadToR2(buffer: Buffer, folder: string, filename: string): Promise<string> {
  const { CloudflareR2MediaStorage } = require('@africonnect/shared');

  const storage = new CloudflareR2MediaStorage({
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    accountId: process.env.R2_ACCOUNT_ID!,
    bucketName: process.env.R2_BUCKET_NAME!,
    cdnDomain: process.env.R2_CDN_DOMAIN || undefined,
  });

  // Extract extension from filename
  const ext = filename.split('.').pop() || 'png';

  // Upload using CloudflareR2MediaStorage
  const result = await storage.upload(buffer, ext, folder);

  logger.info(
    {
      folder,
      filename,
      url: result.url,
      publicId: result.publicId,
    },
    'Successfully uploaded to R2',
  );

  return result.url;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper: Extract folder from Cloudinary public ID
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Extract folder from Cloudinary public ID
 * Examples:
 * - "africonnect/profile-photos/1234567890-abc.png" -> "profile-photos"
 * - "africonnect/chat-images/1234567890-def.jpg" -> "chat-images"
 */
export function extractFolderFromPublicId(publicId: string): string {
  const parts = publicId.split('/');
  // Format: africonnect/{folder}/{filename}
  // We want the folder part (index 1)
  if (parts.length >= 2 && parts[0] === 'africonnect') {
    return parts[1];
  }
  // Fallback: use first part after splitting
  return parts[0] || 'unknown';
}

// ─────────────────────────────────────────────────────────────────────────────
// Database Updater
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Update database records with new R2 URLs after successful migration
 * Logs each migration event with source and destination URLs
 *
 * Handles three types of fields:
 * 1. Profile.photos (profile_profiles)      - JSON array of { url, order, isPrimary }
 * 2. Application.<document>Url (vetting_applications) - Single string URLs
 * 3. Message.imageUrl (chat_messages)       - Single string URL
 *
 * @param prisma - Prisma client
 * @param oldUrl - Source Cloudinary URL
 * @param newUrl - Destination R2 URL
 * @param fieldType - Type of field being updated (photos, single, message)
 * @param context - Row key plus, for `single`, the column being rewritten
 */
async function updateDatabaseWithR2Url(
  prisma: PrismaClient,
  oldUrl: string,
  newUrl: string,
  fieldType: 'photos' | 'single' | 'message',
  context: {
    userId?: string;
    applicationId?: string;
    fieldName?: SingleUrlFieldName;
    messageId?: string;
  },
): Promise<void> {
  logger.info(
    {
      source: oldUrl,
      destination: newUrl,
      fieldType,
      context,
    },
    'Starting database update for migrated image URL',
  );

  try {
    if (fieldType === 'photos') {
      // Profile.photos is a JSON array - need to update the specific photo URL
      if (!context.userId) {
        throw new Error('userId is required for photos field type');
      }

      const profile = await prisma.profile.findUnique({
        where: { userId: context.userId },
        select: { photos: true },
      });

      if (!profile || !profile.photos) {
        logger.warn({ userId: context.userId }, 'Profile not found or has no photos');
        return;
      }

      // Parse photos array and rewrite only the entry whose URL matches.
      // Unrecognised entries are passed through untouched.
      const photos = toPhotoEntries(profile.photos);
      const updatedPhotos: Prisma.JsonValue[] = photos.map((photo) => {
        if (isProfilePhoto(photo) && photo.url === oldUrl) {
          return { ...photo, url: newUrl };
        }
        return photo;
      });

      await prisma.profile.update({
        where: { userId: context.userId },
        // Prisma's JSON input type is intentionally narrower than JsonValue
        // (it excludes top-level null). The array itself is never null here.
        data: { photos: updatedPhotos as Prisma.InputJsonValue },
      });

      logger.info(
        {
          userId: context.userId,
          source: oldUrl,
          destination: newUrl,
        },
        'Successfully migrated profile photo URL in database',
      );
    } else if (fieldType === 'single') {
      // Vetting document columns. These belong to Application, keyed by its own
      // `id` (Application.userId is nullable, so it cannot be the key).
      if (!context.applicationId || !context.fieldName) {
        throw new Error('applicationId and fieldName are required for single field type');
      }

      // Explicit mapping instead of a computed key so the column name stays
      // type-checked against the Prisma schema.
      const data: Prisma.ApplicationUpdateInput =
        context.fieldName === 'idDocumentUrl'
          ? { idDocumentUrl: newUrl }
          : context.fieldName === 'degreeCertificateUrl'
            ? { degreeCertificateUrl: newUrl }
            : context.fieldName === 'selfieUrl'
              ? { selfieUrl: newUrl }
              : { proofOfWorkUrl: newUrl };

      await prisma.application.update({
        where: { id: context.applicationId },
        data,
      });

      logger.info(
        {
          applicationId: context.applicationId,
          fieldName: context.fieldName,
          source: oldUrl,
          destination: newUrl,
        },
        'Successfully migrated single URL in database',
      );
    } else if (fieldType === 'message') {
      // Chat message imageUrl field
      if (!context.messageId) {
        throw new Error('messageId is required for message field type');
      }

      await prisma.message.update({
        where: { id: context.messageId },
        data: { imageUrl: newUrl },
      });

      logger.info(
        {
          messageId: context.messageId,
          source: oldUrl,
          destination: newUrl,
        },
        'Successfully migrated chat message imageUrl in database',
      );
    }
  } catch (error) {
    logger.error(
      {
        error,
        source: oldUrl,
        destination: newUrl,
        fieldType,
        context,
      },
      'Database update failed for migrated image URL',
    );
    throw error;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Migration Steps
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Step 1: Find all profiles with Cloudinary photo URLs
 */
async function findProfilesWithCloudinaryPhotos(): Promise<ProfilePhotosRow[]> {
  return prisma.$queryRaw<ProfilePhotosRow[]>`
    SELECT "userId", photos
    FROM profile_profiles
    WHERE photos IS NOT NULL
    AND photos::text LIKE '%cloudinary.com%'
  `;
}

/**
 * Step 2: Find all vetting applications with Cloudinary document URLs.
 *
 * These columns live on `vetting_applications`. The previous implementation
 * selected them from `profile_profiles`, where they do not exist — Postgres
 * raised `column "idDocumentUrl" does not exist` and aborted the whole phase.
 * It also used `prisma.raw` (not a real API) to build the UPDATE.
 */
async function findApplicationsWithCloudinaryDocumentUrls(): Promise<SingleUrlCandidate[]> {
  const results: SingleUrlCandidate[] = [];

  for (const fieldName of SINGLE_URL_FIELDS) {
    // The column name is interpolated with Prisma.raw (an identifier, not a
    // value, so it cannot be a bound parameter). `fieldName` comes from the
    // SINGLE_URL_FIELDS whitelist above, never from user input.
    const rows = await prisma.$queryRaw<ApplicationSingleUrlRow[]>`
      SELECT id, ${Prisma.raw(`"${fieldName}"`)} AS url
      FROM vetting_applications
      WHERE ${Prisma.raw(`"${fieldName}"`)} LIKE '%cloudinary.com%'
    `;

    results.push(...rows.map((r) => ({ applicationId: r.id, fieldName, oldValue: r.url })));
  }

  return results;
}

/**
 * Step 3: Find all messages with Cloudinary image URLs
 */
async function findMessagesWithCloudinaryImages(): Promise<MessageImageRow[]> {
  return prisma.$queryRaw<MessageImageRow[]>`
    SELECT id, "imageUrl"
    FROM chat_messages
    WHERE "imageUrl" IS NOT NULL
    AND "imageUrl" LIKE '%cloudinary.com%'
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Migration Logic
// ─────────────────────────────────────────────────────────────────────────────
async function migrateProfilePhotos(stats: MigrationStats): Promise<void> {
  logger.info({ phase: 'migrateProfilePhotos' }, 'Starting profile photo migration');

  const profiles = await findProfilesWithCloudinaryPhotos();

  // NOTE: stats are counted per *photo* below, not per profile. The previous
  // `stats.total += profiles.length` mixed units, so total never reconciled
  // against success + failed + skipped.
  logger.info({ count: profiles.length }, 'Found profiles with Cloudinary photos');

  for (const profile of profiles) {
    try {
      logger.info({ userId: profile.userId }, 'Processing profile photos');

      // Parse photos JSON array
      const photos = toPhotoEntries(profile.photos);

      for (const photo of photos) {
        stats.total++;

        // Entries that are not recognisable photos, or already point away from
        // Cloudinary, are left untouched and reported as skipped.
        if (!isProfilePhoto(photo) || !isCloudinaryUrl(photo.url)) {
          stats.skipped++;
          continue;
        }

        const oldUrl = photo.url;

        try {
          // Mirror the source folder structure in R2 (the documented intent of
          // this script). extractFolderFromPublicId was previously defined but
          // never called, leaving the destination folder hardcoded.
          const publicId = extractPublicIdFromCloudinaryUrl(oldUrl);
          const folder = publicId ? extractFolderFromPublicId(publicId) : 'profile-photos';
          const filename =
            publicId?.split('/').pop() ||
            `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

          // Fetch image from Cloudinary
          const buffer = await fetchFromCloudinary(oldUrl);

          // Upload to R2
          const newUrl = await uploadToR2(buffer, folder, filename);

          // Update database with new R2 URL.
          // Delegated to updateDatabaseWithR2Url so the *matching* entry of the
          // photos JSON array is rewritten. The previous inline SQL used
          // `photos::jsonb->>'url'`, which always evaluates to NULL for a JSON
          // array, so the UPDATE matched zero rows while still counting the
          // migration as a success — a silent failure. It also hardcoded index
          // '{0,url}', which would corrupt the wrong photo for multi-photo
          // profiles.
          await updateDatabaseWithR2Url(prisma, oldUrl, newUrl, 'photos', {
            userId: profile.userId,
          });

          stats.success++;
          logger.info(
            {
              userId: profile.userId,
              source: oldUrl,
              destination: newUrl,
            },
            'Successfully migrated profile photo',
          );
        } catch (err) {
          logger.error(
            {
              error: err,
              userId: profile.userId,
              photoUrl: oldUrl,
            },
            'Failed to migrate profile photo',
          );
          stats.failed++;
        }
      }
    } catch (error) {
      logger.error({ error, userId: profile.userId }, 'Failed to process profile');
      stats.failed++;
    }
  }
}

async function migrateApplicationDocumentUrls(stats: MigrationStats): Promise<void> {
  logger.info(
    { phase: 'migrateApplicationDocumentUrls' },
    'Starting vetting document URL migration',
  );

  const urls = await findApplicationsWithCloudinaryDocumentUrls();
  stats.total += urls.length;

  logger.info({ count: urls.length }, 'Found applications with Cloudinary document URLs');

  for (const entry of urls) {
    try {
      logger.info(
        { applicationId: entry.applicationId, fieldName: entry.fieldName },
        'Processing document URL',
      );

      const oldUrl = entry.oldValue;

      try {
        // Mirror the source folder structure in R2. The previous fallback
        // kebab-cased the *column* name ("idDocumentUrl" -> "id-document-url"),
        // which does not match the folder the API originally uploaded to.
        const publicId = extractPublicIdFromCloudinaryUrl(oldUrl);
        const folder = publicId
          ? extractFolderFromPublicId(publicId)
          : entry.fieldName
              .replace(/([A-Z])/g, '-$1')
              .toLowerCase()
              .replace(/^-/, '');
        const filename =
          publicId?.split('/').pop() || `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

        // Fetch image from Cloudinary
        const buffer = await fetchFromCloudinary(oldUrl);

        // Upload to R2
        const newUrl = await uploadToR2(buffer, folder, filename);

        // Update database with new R2 URL.
        // Delegated to updateDatabaseWithR2Url. The previous inline SQL called
        // `prisma.raw(...)`, which does not exist on PrismaClient (the helper is
        // the static `Prisma.raw`), so this threw a TypeError on the very first
        // record and aborted the whole phase.
        await updateDatabaseWithR2Url(prisma, oldUrl, newUrl, 'single', {
          applicationId: entry.applicationId,
          fieldName: entry.fieldName,
        });

        stats.success++;
        logger.info(
          {
            applicationId: entry.applicationId,
            fieldName: entry.fieldName,
            source: oldUrl,
            destination: newUrl,
          },
          'Successfully migrated document URL',
        );
      } catch (err) {
        logger.error(
          {
            error: err,
            applicationId: entry.applicationId,
            fieldName: entry.fieldName,
            sourceUrl: oldUrl,
          },
          'Failed to migrate document URL',
        );
        stats.failed++;
      }
    } catch (error) {
      logger.error({ error, applicationId: entry.applicationId }, 'Failed to process application');
      stats.failed++;
    }
  }
}

async function migrateChatImages(stats: MigrationStats): Promise<void> {
  logger.info({ phase: 'migrateChatImages' }, 'Starting chat image migration');

  const messages = await findMessagesWithCloudinaryImages();
  stats.total += messages.length;

  logger.info({ count: messages.length }, 'Found messages with Cloudinary images');

  for (const message of messages) {
    try {
      logger.info({ messageId: message.id }, 'Processing chat image');

      const oldUrl = message.imageUrl;

      try {
        // Mirror the source folder structure in R2.
        const publicId = extractPublicIdFromCloudinaryUrl(oldUrl);
        const folder = publicId ? extractFolderFromPublicId(publicId) : 'chat-images';
        const filename =
          publicId?.split('/').pop() || `${Date.now()}-${Math.random().toString(36).slice(2)}.png`;

        // Fetch image from Cloudinary
        const buffer = await fetchFromCloudinary(oldUrl);

        // Upload to R2
        const newUrl = await uploadToR2(buffer, folder, filename);

        // Update database with new R2 URL.
        // Delegated to updateDatabaseWithR2Url for consistency with the other
        // two phases (the previous version also discarded its unused result).
        await updateDatabaseWithR2Url(prisma, oldUrl, newUrl, 'message', {
          messageId: message.id,
        });

        stats.success++;
        logger.info(
          {
            messageId: message.id,
            source: oldUrl,
            destination: newUrl,
          },
          'Successfully migrated chat image',
        );
      } catch (err) {
        logger.error(
          {
            error: err,
            messageId: message.id,
            sourceUrl: oldUrl,
          },
          'Failed to migrate chat image',
        );
        stats.failed++;
      }
    } catch (error) {
      logger.error({ error, messageId: message.id }, 'Failed to process message');
      stats.failed++;
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Function
// ─────────────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  logger.info({ phase: 'start' }, 'Starting Cloudinary to R2 migration');

  // Validate configuration
  validateConfig();

  // Initialize stats
  const stats: MigrationStats = {
    total: 0,
    success: 0,
    failed: 0,
    skipped: 0,
  };

  // Perform migrations
  try {
    await migrateProfilePhotos(stats);
    await migrateApplicationDocumentUrls(stats);
    await migrateChatImages(stats);

    logger.info({ stats }, 'Migration completed');
  } catch (error) {
    logger.error({ error, stats }, 'Migration failed');
    throw new InternalError('Migration failed', { stats });
  } finally {
    await prisma.$disconnect();
  }
}

export { main };

// ─────────────────────────────────────────────────────────────────────────────
// Entry Point
// ─────────────────────────────────────────────────────────────────────────────
// Process handlers are installed and the migration is started only when this
// file is executed directly. Previously `main()` ran at import time, which made
// the module impossible to unit-test — the test suite worked around it by
// re-implementing every helper inline, so it asserted against copies of the
// logic instead of the real code (and therefore caught none of the bugs below).
if (require.main === module) {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error({ reason, promise }, 'Unhandled rejection');
    process.exit(1);
  });

  process.on('uncaughtException', (error) => {
    logger.error({ error }, 'Uncaught exception');
    process.exit(1);
  });

  // Run migration
  main().catch((error) => {
    logger.error({ error }, 'Migration terminated with error');
    process.exit(1);
  });
}
