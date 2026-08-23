import { ValidationError } from '@africonnect/shared';

/**
 * Defensive media sanitisation for uploaded files.
 *
 * Two hardening steps run before bytes are handed to storage:
 *   1. EXIF stripping — for JPEG images we drop the APP1 (Exif) and APP2 (ICC/
 *      MPF) metadata segments, which is where camera make/model, GPS
 *      coordinates, and original timestamps live. Stripping them removes the
 *      most common PII-leak surface from member photos without changing the
 *      visible image. This is implemented with no external dependency so the
 *      local/dev path never needs an image-processing toolkit installed.
 *   2. Malware scan hook — an injectable scanner adapter. In local/dev it is a
 *      no-op (returns clean) so the upload flow is fully exercisable without an
 *      AV provider; in production a real adapter (ClamAV/cloud) is wired in via
 *      configuration and any non-clean result aborts the upload.
 *
 * Both steps are deliberately fail-closed for the scanner and fail-safe for the
 * metadata strip: if the bytes are not a recognised image we pass them through
 * untouched rather than risk corrupting a valid PDF.
 */

export type ScanAdapter = (
  buffer: Buffer,
  ext: string,
) => Promise<{ clean: boolean; detail?: string }>;

/** Default no-op scanner: safe for local/dev where no AV provider is configured. */
export const noopScan: ScanAdapter = async () => ({ clean: true });

const JPEG_SOI = 0xffd8; // Start Of Image
const APP1 = 0xffe1; // Exif
const APP2 = 0xffe2; // ICC profile / MPF (some cameras embed GPS here too)
const SOS = 0xffda; // Start Of Scan — image data begins after this

function isJpeg(buf: Buffer): boolean {
  return buf.length >= 2 && buf.readUInt16BE(0) === JPEG_SOI;
}

/**
 * Remove APP1/APP2 metadata segments from a JPEG, leaving the encoded image
 * intact. Returns the original buffer unchanged if it is not a well-formed JPEG
 * we can safely rewrite (defence in depth — never mangle bytes we don't own).
 */
export function stripJpegMetadata(buf: Buffer): Buffer {
  if (!isJpeg(buf)) return buf;

  let pos = 2; // skip SOI
  const out: Buffer[] = [buf.subarray(0, 2)];

  while (pos + 4 <= buf.length) {
    const marker = buf.readUInt16BE(pos);
    if (marker === SOS || marker === 0xffd9 /* EOI */) {
      // Everything from here is scan data / trailer — copy verbatim and stop.
      out.push(buf.subarray(pos));
      return Buffer.concat(out);
    }
    if ((marker & 0xff00) !== 0xff00) {
      // Not a marker boundary; bail out safely.
      return buf;
    }
    const segLen = buf.readUInt16BE(pos + 2);
    if (segLen < 2 || pos + 2 + segLen > buf.length) {
      return buf; // malformed length; don't guess
    }
    const keepSegment = marker !== APP1 && marker !== APP2;
    if (keepSegment) {
      out.push(buf.subarray(pos, pos + 2 + segLen));
    }
    pos += 2 + segLen;
  }

  return Buffer.concat(out);
}

/**
 * Sanitise an upload buffer before storage.
 * @param buffer raw bytes from the client
 * @param ext    canonical extension already derived from magic bytes
 * @param scan   malware-scan adapter (defaults to no-op for local/dev)
 */
export async function sanitizeUpload(
  buffer: Buffer,
  ext: string,
  scan: ScanAdapter = noopScan,
): Promise<Buffer> {
  const lower = ext.toLowerCase();
  if (lower === 'jpg' || lower === 'jpeg') {
    buffer = stripJpegMetadata(buffer);
  }
  const result = await scan(buffer, lower);
  if (!result.clean) {
    throw new ValidationError(result.detail || 'Upload failed security scan');
  }
  return buffer;
}
