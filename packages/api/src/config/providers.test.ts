jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn();
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn().mockImplementation((params) => params),
    DeleteObjectCommand: jest.fn().mockImplementation((params) => params),
  };
});

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    uploader: {
      upload: jest.fn(),
      destroy: jest.fn(),
    },
  },
}));

import type { IMediaStorage } from '@africonnect/shared';
import { readFile } from 'fs/promises';
import { rmSync } from 'fs';
import path from 'path';

// Snapshot of the original environment so we can restore it after each test.
const originalEnv = { ...process.env };

/**
 * Re-require the providers module after resetting the module registry.
 * This ensures config is freshly evaluated from the current process.env.
 */
function loadProviders(): { createMediaStorage: () => IMediaStorage } {
  jest.resetModules();
  return require('@config/providers') as {
    createMediaStorage: () => IMediaStorage;
  };
}

describe('Provider Factory', () => {
  beforeEach(() => {
    // Restore the original environment, then always set a test Stripe key
    // to satisfy the live-key guard in config/index.ts.
    process.env = { ...originalEnv };
    process.env.STRIPE_SECRET_KEY = 'sk_test_abc123';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Property 4: Provider switching preserves existing behavior
  // ─────────────────────────────────────────────────────────────────────────
  describe('Property 4: Provider switching preserves existing behavior', () => {
    it('returns LocalMediaStorage when mediaProvider is "local"', () => {
      process.env.MEDIA_PROVIDER = 'local';
      const { createMediaStorage } = loadProviders();
      const storage = createMediaStorage();
      expect(storage.name).toBe('local');
    });

    it('returns CloudinaryMediaStorage when mediaProvider is "cloudinary"', () => {
      process.env.MEDIA_PROVIDER = 'cloudinary';
      process.env.CLOUDINARY_URL = 'cloudinary://key:secret@cloud';
      const { createMediaStorage } = loadProviders();
      const storage = createMediaStorage();
      expect(storage.name).toBe('cloudinary');
    });

    it('returns CloudflareR2MediaStorage when mediaProvider is "r2"', () => {
      process.env.MEDIA_PROVIDER = 'r2';
      process.env.R2_ACCESS_KEY_ID = 'test-access-key';
      process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
      process.env.R2_ACCOUNT_ID = 'test-account-id';
      process.env.R2_BUCKET_NAME = 'test-bucket';
      const { createMediaStorage } = loadProviders();
      const storage = createMediaStorage();
      expect(storage.name).toBe('r2');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Integration tests for provider factory (Task 6.1)
  // ─────────────────────────────────────────────────────────────────────────
  describe('Provider factory integration (Task 6.1)', () => {
    it('returns the correct provider type for each MEDIA_PROVIDER value', () => {
      // ── local ──
      process.env.MEDIA_PROVIDER = 'local';
      let { createMediaStorage } = loadProviders();
      expect(createMediaStorage().name).toBe('local');

      // ── cloudinary ──
      process.env.MEDIA_PROVIDER = 'cloudinary';
      process.env.CLOUDINARY_URL = 'cloudinary://key:secret@cloud';
      ({ createMediaStorage } = loadProviders());
      expect(createMediaStorage().name).toBe('cloudinary');

      // ── r2 ──
      process.env.MEDIA_PROVIDER = 'r2';
      process.env.R2_ACCESS_KEY_ID = 'test-access-key';
      process.env.R2_SECRET_ACCESS_KEY = 'test-secret-key';
      process.env.R2_ACCOUNT_ID = 'test-account-id';
      process.env.R2_BUCKET_NAME = 'test-bucket';
      ({ createMediaStorage } = loadProviders());
      expect(createMediaStorage().name).toBe('r2');
    });

    it('falls back to LocalMediaStorage for unknown providers', () => {
      process.env.MEDIA_PROVIDER = 'foobar-unknown';
      const { createMediaStorage } = loadProviders();
      const storage = createMediaStorage();
      expect(storage.name).toBe('local');
    });

    it('falls back to LocalMediaStorage when MEDIA_PROVIDER is unset/empty', () => {
      // Use empty string so dotenv does not override it from .env.
      process.env.MEDIA_PROVIDER = '';
      const { createMediaStorage } = loadProviders();
      const storage = createMediaStorage();
      expect(storage.name).toBe('local');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Property 5: Upload round-trip preserves data
  // ─────────────────────────────────────────────────────────────────────────
  describe('Property 5: Upload round-trip preserves data', () => {
    const testFolder = 'test-roundtrip';
    const uploadsDir = path.join(process.cwd(), 'uploads', testFolder);

    afterEach(() => {
      // Clean up any files written during the test.
      // Wrapped in try-catch because sandboxed environments may intercept
      // file deletion calls; cleanup failure is not a test failure.
      try {
        rmSync(uploadsDir, { recursive: true, force: true });
      } catch {
        // ignored
      }
    });

    it('writes a buffer to disk and the file content matches the upload', async () => {
      process.env.MEDIA_PROVIDER = 'local';
      const { createMediaStorage } = loadProviders();
      const storage = createMediaStorage();

      const payload = Buffer.from('round-trip-test-payload-content');
      const result = await storage.upload(payload, 'png', testFolder);

      // The publicId is {folder}/{file} relative to the uploads directory.
      const filePath = path.join(process.cwd(), 'uploads', result.publicId);
      const fileBuffer = await readFile(filePath);

      // The file on disk must exactly match the uploaded buffer.
      expect(fileBuffer).toEqual(payload);

      // The URL should reference the uploads path.
      expect(result.url).toContain('/uploads/');
      expect(result.url).toContain(testFolder);
    });
  });
});
