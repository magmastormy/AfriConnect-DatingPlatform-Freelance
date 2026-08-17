import { UploadResult } from '@africonnect/shared';

/** Re-export the storage upload result so consumers need only import from here. */
export type { UploadResult };

/** Storage folders accepted by the upload endpoint (Change A). */
export type UploadFolder = 'vetting' | 'photos' | 'proof';

/**
 * Canonical file extension derived from magic bytes. The storage layer maps
 * these to the correct content type; we never trust the client extension.
 */
export type CanonicalExt = 'jpg' | 'png' | 'pdf';
