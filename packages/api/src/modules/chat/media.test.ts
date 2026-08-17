import { LocalMediaStorage } from '@africonnect/shared';
import { readFile } from 'fs/promises';
import path from 'path';

describe('LocalMediaStorage (dev fallback for Cloudinary)', () => {
  it('writes a buffer and serves a /uploads URL', async () => {
    const store = new LocalMediaStorage();
    const buf = Buffer.from('fake-image-bytes');
    const res = await store.upload(buf, 'png', 'chat');
    expect(res.url.startsWith('/uploads/chat/')).toBe(true);

    const written = await readFile(
      path.join(process.cwd(), 'uploads', res.url.replace('/uploads/', '')),
    );
    expect(written.equals(buf)).toBe(true);

    await store.remove(res.publicId);
  });

  it('sanitizes folder names to avoid path traversal', async () => {
    const store = new LocalMediaStorage();
    const res = await store.upload(Buffer.from('x'), 'jpg', '../evil');
    // the "../" is stripped, so the file lands under uploads/evil
    expect(res.url).not.toContain('..');
  });
});
