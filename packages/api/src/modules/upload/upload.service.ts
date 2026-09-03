import { IMediaStorage, UploadResult, ValidationError, toBrowserMediaUrl } from '@africonnect/shared';
import { UPLOAD_MAX_BYTES, UPLOAD_MAGIC_SIGNATURES } from '@africonnect/shared';
import { UploadFolder, CanonicalExt } from './upload.types';
import { sanitizeUpload, noopScan, type ScanAdapter } from './upload.sanitize';

export interface IUploadService {
  upload(buffer: Buffer, folder: UploadFolder): Promise<UploadResult>;
}

/**
 * Validates an uploaded buffer by magic bytes (never the client-supplied
 * extension — AGENTS.md Clause 3.7) and delegates storage to the configured
 * `IMediaStorage` (R2 in prod, Local/Cloudinary in dev). Before storage the
 * buffer is sanitised: EXIF metadata is stripped from images and a (pluggable)
 * malware-scan adapter runs. The module has no DB entity of its own.
 */
export class UploadService implements IUploadService {
  constructor(
    private readonly storage: IMediaStorage,
    private readonly scan: ScanAdapter = noopScan,
  ) {}

  /** Returns the canonical extension derived from the file's leading bytes. */
  private detectExt(buf: Buffer): CanonicalExt {
    for (const [ext, signature] of Object.entries(UPLOAD_MAGIC_SIGNATURES)) {
      if (buf.length >= signature.length && signature.every((b, i) => buf[i] === b)) {
        return ext as CanonicalExt;
      }
    }
    throw new ValidationError('Unsupported file type. Allowed: JPG, PNG, PDF.');
  }

  async upload(buffer: Buffer, folder: UploadFolder): Promise<UploadResult> {
    if (!buffer || buffer.length === 0) {
      throw new ValidationError('Empty file');
    }
    if (buffer.length > UPLOAD_MAX_BYTES) {
      throw new ValidationError('File exceeds the maximum allowed size');
    }
    const ext = this.detectExt(buffer);
    const safe = await sanitizeUpload(buffer, ext, this.scan);
    const result = await this.storage.upload(safe, ext, folder);
    // Return a browser-loadable URL: on private R2 buckets the raw object URL
    // 403s for anonymous GETs, so mint a presigned URL right here. The raw key
    // is preserved as publicId for later removal/re-signing.
    return {
      ...result,
      url: (await toBrowserMediaUrl(result.url, this.storage)) ?? result.url,
    };
  }
}
