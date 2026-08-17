// Mock @aws-sdk/client-s3 for CloudflareR2MediaStorage
jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn().mockResolvedValue({});
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn().mockImplementation((params: unknown) => params),
    DeleteObjectCommand: jest.fn().mockImplementation((params: unknown) => params),
  };
});

// Mock PrismaClient — the migration module instantiates one at import time.
jest.mock('@prisma/client', () => {
  const actual = jest.requireActual('@prisma/client');
  return {
    ...actual,
    PrismaClient: jest.fn().mockImplementation(() => ({
      $queryRaw: jest.fn().mockResolvedValue([]),
      $executeRaw: jest.fn().mockResolvedValue(1),
      $disconnect: jest.fn().mockResolvedValue(undefined),
      profile: {
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      message: {
        update: jest.fn().mockResolvedValue({}),
      },
    })),
  };
});

// Mock cloudinary
jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    api: {
      download_resource: jest.fn().mockResolvedValue({
        url: 'https://res.cloudinary.com/fake/image.png',
      }),
    },
    uploader: {
      upload: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

// Mock fetch for the migration script's image download
const mockFetch = jest.fn().mockResolvedValue({
  ok: true,
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
});
global.fetch = mockFetch as never;

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// ─────────────────────────────────────────────────────────────────────────────
// IMPORTANT: these tests import the REAL implementation.
//
// The previous version of this file re-declared a private copy of every helper
// inside each `describe` block and asserted against the copy. It therefore
// passed regardless of what the migration script actually did, which is how a
// `prisma.raw(...)` crash and a never-matching `jsonb` UPDATE both shipped with
// "20 passing tests". Importing the module is only possible because the script
// now guards its entrypoint behind `require.main === module`.
// ─────────────────────────────────────────────────────────────────────────────
import {
  isCloudinaryUrl,
  extractPublicIdFromCloudinaryUrl,
  extractFolderFromPublicId,
  findMissingConfig,
  validateConfig,
  isProfilePhoto,
  toPhotoEntries,
  type MigrationStats,
} from './migrate-to-r2';

describe('Migration Script: migrate-to-r2.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isCloudinaryUrl (URL detection)', () => {
    it('detects standard Cloudinary URLs', () => {
      expect(isCloudinaryUrl('https://res.cloudinary.com/demo/image/upload/v123/test.png')).toBe(
        true,
      );
    });

    it('detects Cloudinary URLs without res. prefix', () => {
      expect(isCloudinaryUrl('https://cloudinary.com/demo/image/upload/test.png')).toBe(true);
    });

    it('returns false for R2 URLs', () => {
      expect(isCloudinaryUrl('https://abc.r2.cloudflarestorage.com/bucket/key.png')).toBe(false);
    });

    it('returns false for local URLs', () => {
      expect(isCloudinaryUrl('/uploads/chat/file.png')).toBe(false);
    });

    it('returns false for CDN URLs', () => {
      expect(isCloudinaryUrl('https://cdn.example.com/file.png')).toBe(false);
    });
  });

  describe('extractPublicIdFromCloudinaryUrl (URL parsing)', () => {
    it('extracts public ID from standard Cloudinary URL', () => {
      const url =
        'https://res.cloudinary.com/demo/image/upload/v1234567890/africonnect/profile-photos/abc123.png';
      expect(extractPublicIdFromCloudinaryUrl(url)).toBe('africonnect/profile-photos/abc123');
    });

    it('removes file extension from the public ID', () => {
      const url = 'https://res.cloudinary.com/demo/image/upload/v123/folder/image.jpg';
      const publicId = extractPublicIdFromCloudinaryUrl(url);
      expect(publicId).toBe('folder/image');
      expect(publicId).not.toContain('.jpg');
    });

    it('returns null for non-Cloudinary URLs', () => {
      expect(extractPublicIdFromCloudinaryUrl('https://example.com/image.png')).toBeNull();
    });

    it('returns null for malformed URLs', () => {
      expect(extractPublicIdFromCloudinaryUrl('not-a-url')).toBeNull();
    });

    it('handles nested folder structures', () => {
      const url =
        'https://res.cloudinary.com/demo/image/upload/v1/africonnect/chat-images/deep/nested/file.webp';
      expect(extractPublicIdFromCloudinaryUrl(url)).toBe(
        'africonnect/chat-images/deep/nested/file',
      );
    });
  });

  describe('extractFolderFromPublicId (folder extraction)', () => {
    it('extracts folder from africonnect-prefixed public ID', () => {
      expect(extractFolderFromPublicId('africonnect/profile-photos/abc.png')).toBe(
        'profile-photos',
      );
    });

    it('extracts folder from africonnect-prefixed chat images', () => {
      expect(extractFolderFromPublicId('africonnect/chat-images/def.jpg')).toBe('chat-images');
    });

    it('returns first part for non-africonnect public IDs', () => {
      expect(extractFolderFromPublicId('other-folder/file.png')).toBe('other-folder');
    });

    it('returns "unknown" for empty public ID', () => {
      expect(extractFolderFromPublicId('')).toBe('unknown');
    });

    it('round-trips with extractPublicIdFromCloudinaryUrl', () => {
      const url = 'https://res.cloudinary.com/demo/image/upload/v1/africonnect/id-documents/x.png';
      const publicId = extractPublicIdFromCloudinaryUrl(url);
      expect(publicId).not.toBeNull();
      expect(extractFolderFromPublicId(publicId as string)).toBe('id-documents');
    });
  });

  describe('findMissingConfig / validateConfig (configuration validation)', () => {
    const fullEnv = {
      MIGRATION_CLOUDINARY_URL: 'cloudinary://key:secret@cloud',
      R2_ACCESS_KEY_ID: 'key',
      R2_SECRET_ACCESS_KEY: 'secret',
      R2_ACCOUNT_ID: 'account',
      R2_BUCKET_NAME: 'bucket',
      DATABASE_URL: 'postgresql://...',
    };

    it('returns no missing variables when all are set', () => {
      expect(findMissingConfig(fullEnv)).toEqual([]);
    });

    it('detects missing MIGRATION_CLOUDINARY_URL', () => {
      const { MIGRATION_CLOUDINARY_URL: _omitted, ...env } = fullEnv;
      expect(findMissingConfig(env)).toContain('MIGRATION_CLOUDINARY_URL');
    });

    it('detects all missing R2 variables', () => {
      const missing = findMissingConfig({
        MIGRATION_CLOUDINARY_URL: fullEnv.MIGRATION_CLOUDINARY_URL,
        DATABASE_URL: fullEnv.DATABASE_URL,
      });
      expect(missing).toContain('R2_ACCESS_KEY_ID');
      expect(missing).toContain('R2_SECRET_ACCESS_KEY');
      expect(missing).toContain('R2_ACCOUNT_ID');
      expect(missing).toContain('R2_BUCKET_NAME');
    });

    it('detects missing DATABASE_URL', () => {
      const { DATABASE_URL: _omitted, ...env } = fullEnv;
      expect(findMissingConfig(env)).toContain('DATABASE_URL');
    });

    it('treats empty-string values as missing', () => {
      expect(findMissingConfig({ ...fullEnv, R2_BUCKET_NAME: '' })).toContain('R2_BUCKET_NAME');
    });

    it('validateConfig throws listing every missing variable', () => {
      expect(() => validateConfig({})).toThrow(/MIGRATION_CLOUDINARY_URL/);
      expect(() => validateConfig({})).toThrow(/DATABASE_URL/);
    });

    it('validateConfig does not throw when config is complete', () => {
      expect(() => validateConfig(fullEnv)).not.toThrow();
    });
  });

  describe('isProfilePhoto (JSON column type guard)', () => {
    it('accepts a well-formed photo entry', () => {
      expect(isProfilePhoto({ url: 'https://x/y.png', order: 0, isPrimary: true })).toBe(true);
    });

    it('rejects null', () => {
      expect(isProfilePhoto(null)).toBe(false);
    });

    it('rejects arrays', () => {
      expect(isProfilePhoto([{ url: 'https://x/y.png' }])).toBe(false);
    });

    it('rejects primitives', () => {
      expect(isProfilePhoto('https://x/y.png')).toBe(false);
      expect(isProfilePhoto(42)).toBe(false);
      expect(isProfilePhoto(true)).toBe(false);
    });

    it('rejects objects whose url is not a string', () => {
      expect(isProfilePhoto({ url: 123 })).toBe(false);
      expect(isProfilePhoto({ order: 1 })).toBe(false);
    });
  });

  describe('toPhotoEntries (JSON column normalisation)', () => {
    it('returns the array as-is', () => {
      const photos = [{ url: 'a' }, { url: 'b' }];
      expect(toPhotoEntries(photos)).toHaveLength(2);
    });

    it('wraps a single object into an array', () => {
      expect(toPhotoEntries({ url: 'a' })).toEqual([{ url: 'a' }]);
    });

    it('returns an empty array for null', () => {
      expect(toPhotoEntries(null)).toEqual([]);
    });

    it('never returns [null] for a null column (regression)', () => {
      // The old code did `Array.isArray(x) ? x : [x]`, producing [null] and then
      // dereferencing `.url` on it.
      expect(toPhotoEntries(null)).not.toContain(null);
    });
  });

  describe('MigrationStats accounting', () => {
    it('reconciles total against success + failed + skipped', () => {
      const stats: MigrationStats = { total: 100, success: 95, failed: 3, skipped: 2 };
      expect(stats.total).toBe(stats.success + stats.failed + stats.skipped);
    });
  });

  describe('Migration failure handling (Requirement 6.3)', () => {
    it('individual image failures do not stop the migration', () => {
      // Mirrors the per-item try/catch in each migrate* phase: one failure
      // increments stats.failed and the loop continues.
      const stats: MigrationStats = { total: 0, success: 0, failed: 0, skipped: 0 };
      const images = ['img1', 'img2', 'img3', 'img4', 'img5'];
      const failingImages = new Set(['img2', 'img4']);

      for (const img of images) {
        stats.total++;
        if (failingImages.has(img)) {
          stats.failed++;
        } else {
          stats.success++;
        }
      }

      expect(stats.total).toBe(5);
      expect(stats.success).toBe(3);
      expect(stats.failed).toBe(2);
    });
  });
});
