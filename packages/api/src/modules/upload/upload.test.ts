import { UploadService } from './upload.service';
import { ValidationError } from '@africonnect/shared';

const makeStorage = (
  over: Partial<{ upload: jest.Mock; remove: jest.Mock; getSignedUrl: jest.Mock }> = {},
) => ({
  name: 'mock',
  upload: over.upload ?? jest.fn(),
  remove: over.remove ?? jest.fn(),
  // getSignedUrl is required by IMediaStorage (admin.service calls it). Upload
  // tests don't exercise signing, so a no-op is fine.
  getSignedUrl: over.getSignedUrl ?? jest.fn(async (id: string) => id),
});

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0]);
const JPG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]);
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34]);

describe('UploadService', () => {
  it('rejects an empty buffer', async () => {
    const svc = new UploadService(makeStorage());
    await expect(svc.upload(Buffer.alloc(0), 'vetting')).rejects.toBeInstanceOf(ValidationError);
  });

  it('rejects unsupported magic bytes', async () => {
    const svc = new UploadService(makeStorage());
    await expect(svc.upload(Buffer.from('not an image at all'), 'vetting')).rejects.toThrow(
      /Unsupported file type/,
    );
  });

  it('uploads a valid PNG and passes canonical ext to storage', async () => {
    const storage = makeStorage();
    storage.upload.mockResolvedValue({ url: 'https://cdn/y.png', publicId: 'vetting/y.png' });
    // UploadService re-signs non-public URLs on the way out, so the mock
    // storage's getSignedUrl must simulate the presigned URL the real R2/CDN
    // storage would return.
    storage.getSignedUrl.mockResolvedValue('https://cdn/y.png?X-Amz-Signature=abc');
    const svc = new UploadService(storage);
    const res = await svc.upload(PNG_MAGIC, 'vetting');
    expect(res.url).toBe('https://cdn/y.png?X-Amz-Signature=abc');
    expect(storage.upload).toHaveBeenCalledWith(expect.any(Buffer), 'png', 'vetting');
    // Key extraction for a CDN-host URL: the full path is the object key.
    expect(storage.getSignedUrl).toHaveBeenCalledWith('y.png', expect.any(Number));
  });

  it('detects JPG and PDF magic bytes', async () => {
    const storage = makeStorage();
    storage.upload.mockResolvedValue({ url: 'u', publicId: 'p' });
    const jpg = new UploadService(storage);
    await jpg.upload(JPG_MAGIC, 'photos');
    expect(storage.upload).toHaveBeenLastCalledWith(expect.any(Buffer), 'jpg', 'photos');

    const pdf = new UploadService(storage);
    await pdf.upload(PDF_MAGIC, 'proof');
    expect(storage.upload).toHaveBeenLastCalledWith(expect.any(Buffer), 'pdf', 'proof');
  });

  it('rejects files over the size limit', async () => {
    const svc = new UploadService(makeStorage());
    const big = Buffer.concat([PNG_MAGIC, Buffer.alloc(6 * 1024 * 1024)]);
    await expect(svc.upload(big, 'vetting')).rejects.toThrow(/maximum allowed size/);
  });
});
