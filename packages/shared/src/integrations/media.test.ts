jest.mock('@aws-sdk/client-s3', () => {
  const mockSend = jest.fn();
  return {
    S3Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    PutObjectCommand: jest.fn().mockImplementation((params) => params),
    DeleteObjectCommand: jest.fn().mockImplementation((params) => params),
    __mockSend: mockSend,
  };
});

jest.mock('../logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    child: jest.fn().mockReturnThis(),
  },
}));

import { CloudflareR2MediaStorage } from './media';
import { InternalError } from '../errors/AppError';
import { logger } from '../logger';

// Access the mocked AWS SDK internals (require returns the mocked module above).
// Typed explicitly so the mock handles stay checked instead of being `any`.
interface MockedS3Module {
  __mockSend: jest.Mock;
  PutObjectCommand: jest.Mock;
  DeleteObjectCommand: jest.Mock;
}
const awsSdk = require('@aws-sdk/client-s3') as MockedS3Module;
const mockSend: jest.Mock = awsSdk.__mockSend;
const mockPutObjectCommand: jest.Mock = awsSdk.PutObjectCommand;
const mockDeleteObjectCommand: jest.Mock = awsSdk.DeleteObjectCommand;

// Convenience references to mocked logger methods.
const mockLoggerInfo = logger.info as jest.Mock;
const mockLoggerWarn = logger.warn as jest.Mock;
const mockLoggerError = logger.error as jest.Mock;

// Reusable valid config for tests that need a constructed R2 storage instance.
const validConfig = {
  accessKeyId: 'test-access-key-id',
  secretAccessKey: 'test-secret-access-key',
  accountId: 'test-account-id',
  bucketName: 'test-bucket-name',
};

describe('CloudflareR2MediaStorage', () => {
  beforeEach(() => {
    mockSend.mockReset();
    mockPutObjectCommand.mockClear();
    mockDeleteObjectCommand.mockClear();
    mockLoggerInfo.mockClear();
    mockLoggerWarn.mockClear();
    mockLoggerError.mockClear();
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Property 1: R2 provider uploads to correct bucket
  // ─────────────────────────────────────────────────────────────────────────
  describe('Property 1: R2 provider uploads to correct bucket', () => {
    it('sends PutObjectCommand with correct Bucket, Key, Body, ContentType, and ACL', async () => {
      mockSend.mockResolvedValue(undefined);

      const storage = new CloudflareR2MediaStorage(validConfig);
      const buffer = Buffer.from('fake-image-data');

      const result = await storage.upload(buffer, 'png', 'profile-photos');

      // PutObjectCommand was constructed once.
      expect(mockPutObjectCommand).toHaveBeenCalledTimes(1);
      const params = mockPutObjectCommand.mock.calls[0][0];

      // Bucket matches the configured bucket name.
      expect(params.Bucket).toBe('test-bucket-name');

      // Key format: {folder}/{timestamp}-{random}.{ext}
      expect(params.Key).toMatch(/^profile-photos\/\d+-[a-z0-9]+\.png$/);

      // Body is the uploaded buffer.
      expect(params.Body).toBe(buffer);

      // ContentType is set correctly for .png.
      expect(params.ContentType).toBe('image/png');

      // ACL is public-read.
      expect(params.ACL).toBe('public-read');

      // The returned URL and publicId are derived from the key.
      expect(result.publicId).toBe(params.Key);
      expect(result.url).toContain(params.Key);
    });

    it('maps file extensions to correct ContentType values', async () => {
      mockSend.mockResolvedValue(undefined);
      const storage = new CloudflareR2MediaStorage(validConfig);

      const cases: Array<[string, string]> = [
        ['jpg', 'image/jpeg'],
        ['jpeg', 'image/jpeg'],
        ['png', 'image/png'],
        ['gif', 'image/gif'],
        ['webp', 'image/webp'],
        ['svg', 'image/svg+xml'],
        ['pdf', 'application/pdf'],
        ['unknown', 'application/octet-stream'],
      ];

      for (const [ext, expectedContentType] of cases) {
        mockPutObjectCommand.mockClear();
        await storage.upload(Buffer.from('x'), ext, 'test');
        const params = mockPutObjectCommand.mock.calls[0][0];
        expect(params.ContentType).toBe(expectedContentType);
      }
    });

    it('sanitizes the folder name in the object key', async () => {
      mockSend.mockResolvedValue(undefined);
      const storage = new CloudflareR2MediaStorage(validConfig);

      // Special characters should be stripped from the folder.
      await storage.upload(Buffer.from('x'), 'png', 'user/../profile!photos');
      const params = mockPutObjectCommand.mock.calls[0][0];
      expect(params.Key).toMatch(/^userprofilephotos\/\d+-[a-z0-9]+\.png$/);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Property 2: R2 URLs use CDN domain
  // ─────────────────────────────────────────────────────────────────────────
  describe('Property 2: R2 URLs use CDN domain', () => {
    it('uses default R2 URL format when no CDN domain is set', async () => {
      mockSend.mockResolvedValue(undefined);

      const storage = new CloudflareR2MediaStorage({
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        accountId: 'myaccount',
        bucketName: 'mybucket',
      });

      const result = await storage.upload(Buffer.from('data'), 'png', 'images');

      // URL format: https://{accountId}.r2.cloudflarestorage.com/{bucket}/{key}
      expect(result.url).toMatch(
        /^https:\/\/myaccount\.r2\.cloudflarestorage\.com\/mybucket\/images\/.+\.png$/,
      );
    });

    it('uses custom CDN domain when provided', async () => {
      mockSend.mockResolvedValue(undefined);

      const storage = new CloudflareR2MediaStorage({
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        accountId: 'myaccount',
        bucketName: 'mybucket',
        cdnDomain: 'cdn.africonnect.example',
      });

      const result = await storage.upload(Buffer.from('data'), 'png', 'images');

      // URL format: https://{cdnDomain}/{key}
      expect(result.url).toMatch(/^https:\/\/cdn\.africonnect\.example\/images\/.+\.png$/);
      // Should NOT contain the default R2 domain or bucket name.
      expect(result.url).not.toContain('r2.cloudflarestorage.com');
      expect(result.url).not.toContain('mybucket');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Property 3: Remove handles missing objects gracefully
  // ─────────────────────────────────────────────────────────────────────────
  describe('Property 3: Remove handles missing objects gracefully', () => {
    it('does not throw and logs a warning when object is not found (NotFound code)', async () => {
      const notFoundError = Object.assign(new Error('Not Found'), {
        code: 'NotFound',
      });
      mockSend.mockRejectedValue(notFoundError);

      const storage = new CloudflareR2MediaStorage(validConfig);

      // remove() must NOT throw.
      await expect(storage.remove('some/key.png')).resolves.toBeUndefined();

      // remove() caught the error and logged a warning.
      expect(mockLoggerWarn).toHaveBeenCalled();
    });

    it('does not throw and logs a warning when object is not found (NoSuchKey code)', async () => {
      const noSuchKeyError = Object.assign(new Error('No Such Key'), {
        code: 'NoSuchKey',
      });
      mockSend.mockRejectedValue(noSuchKeyError);

      const storage = new CloudflareR2MediaStorage(validConfig);

      await expect(storage.remove('missing/key.png')).resolves.toBeUndefined();
      expect(mockLoggerWarn).toHaveBeenCalled();
    });

    it('catches and logs other errors without throwing', async () => {
      mockSend.mockRejectedValue(new Error('Network error'));

      const storage = new CloudflareR2MediaStorage(validConfig);

      await expect(storage.remove('any/key.png')).resolves.toBeUndefined();
      expect(mockLoggerWarn).toHaveBeenCalled();
    });

    it('sends DeleteObjectCommand with correct Bucket and Key', async () => {
      mockSend.mockResolvedValue(undefined);

      const storage = new CloudflareR2MediaStorage(validConfig);
      await storage.remove('profile-photos/123-abc.png');

      expect(mockDeleteObjectCommand).toHaveBeenCalledTimes(1);
      const params = mockDeleteObjectCommand.mock.calls[0][0];
      expect(params.Bucket).toBe('test-bucket-name');
      expect(params.Key).toBe('profile-photos/123-abc.png');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // Constructor validation
  // ─────────────────────────────────────────────────────────────────────────
  describe('Constructor validation', () => {
    it('throws InternalError when ALL required config is missing', () => {
      const construct = () =>
        new CloudflareR2MediaStorage({
          accessKeyId: '',
          secretAccessKey: '',
          accountId: '',
          bucketName: '',
        });

      expect(construct).toThrow(InternalError);

      // Error message lists ALL missing variables, in order.
      expect(construct).toThrow(
        /R2_ACCESS_KEY_ID.*R2_SECRET_ACCESS_KEY.*R2_ACCOUNT_ID.*R2_BUCKET_NAME/,
      );
    });

    it('throws InternalError when only SOME config is missing', () => {
      const construct = () =>
        new CloudflareR2MediaStorage({
          accessKeyId: 'has-key',
          secretAccessKey: '',
          accountId: 'has-account',
          bucketName: '',
        });

      expect(construct).toThrow(InternalError);

      // Only the missing variables are listed.
      expect(construct).toThrow(/R2_SECRET_ACCESS_KEY.*R2_BUCKET_NAME/);

      // Present variables are NOT listed.
      let message = '';
      try {
        construct();
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).not.toContain('R2_ACCESS_KEY_ID');
      expect(message).not.toContain('R2_ACCOUNT_ID');
    });

    it('does not throw when all required config is present (with optional CDN omitted)', () => {
      expect(() => new CloudflareR2MediaStorage(validConfig)).not.toThrow();
    });
  });
});
