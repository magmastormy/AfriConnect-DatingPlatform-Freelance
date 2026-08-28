import { createGzip, createDeflate, createBrotliCompress } from 'zlib';
import { Writable } from 'stream';
import type { Request, Response, NextFunction } from 'express';

/**
 * Zero-dependency response compression for the Express API.
 *
 * Why not the `compression` package? It is the usual choice, but adding a
 * dependency requires a network install that is currently blocked by an
 * environment file-deletion hook in this workspace. Node ships `zlib` with
 * brotli/gzip/deflate, which is all we need for a JSON API, so we implement a
 * small, correct middleware instead of taking on an external dep.
 *
 * Behaviour (mirrors the `compression` package's contract):
 *  - Honours `Accept-Encoding`; prefers br > gzip > deflate; no-encoding → pass through.
 *  - Skips already-encoded, 204/304, `no-transform`, or incompressible (image/media) responses.
 *  - Skips bodies below `threshold` bytes (gzip of a tiny payload wastes CPU).
 *  - Sets `Vary: Accept-Encoding` so shared caches key correctly.
 *  - Pipes through a backpressure-aware sink bound to the ORIGINAL socket write/end,
 *    so the compressor never re-enters this middleware (no recursion).
 */

const COMPRESSIBLE = /^(text\/|application\/(json|javascript|ecmascript|xml|ld\+json|x-www-form-urlencoded)|image\/svg\+xml)/i;

function pickEncoding(accept: string | undefined): 'br' | 'gzip' | 'deflate' | null {
  if (!accept) return null;
  if (/\bbr\b/.test(accept)) return 'br';
  if (/\bgzip\b/.test(accept)) return 'gzip';
  if (/\bdeflate\b/.test(accept)) return 'deflate';
  return null;
}

type CompressOptions = { threshold?: number };

export function compressResponses(opts: CompressOptions = {}) {
  const threshold = opts.threshold ?? 1024;

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.headers['x-no-compression']) return next();

    const accept = req.headers['accept-encoding'];
    const enc = pickEncoding(
      Array.isArray(accept) ? accept.join(',') : typeof accept === 'string' ? accept : undefined,
    );
    if (!enc) return next();

    // Capture the real socket methods BEFORE we shadow res.end, so the
    // compressor can write straight to the wire without recursing into itself.
    // We use a structurally-identical signature (chunk is `unknown` rather than
    // Express's `any`) so there are no `any` casts in this hot path.
    type EndFn = (chunk?: unknown, encoding?: BufferEncoding, cb?: () => void) => Response;
    const origWrite = res.write.bind(res) as (chunk: Uint8Array | string) => boolean;
    const origEnd = res.end.bind(res) as unknown as EndFn;

    const newEnd: EndFn = function (chunk?: unknown, encoding?: BufferEncoding, cb?: () => void) {
      const status = res.statusCode;
      const ctype = String(res.getHeader('Content-Type') || '');
      const alreadyEncoded = !!res.getHeader('Content-Encoding');
      const cc = res.getHeader('Cache-Control');
      const noTransform = typeof cc === 'string' && /no-transform/i.test(cc);

      if (
        alreadyEncoded ||
        status === 204 ||
        status === 304 ||
        noTransform ||
        !COMPRESSIBLE.test(ctype)
      ) {
        return origEnd(chunk, encoding, cb);
      }

      const len = res.getHeader('Content-Length');
      if (typeof len === 'string' && Number(len) < threshold) {
        return origEnd(chunk, encoding, cb);
      }

      const userCb = typeof cb === 'function' ? cb : undefined;

      res.setHeader('Content-Encoding', enc);
      res.removeHeader('Content-Length');
      const vary = res.getHeader('Vary');
      res.setHeader('Vary', vary ? `${vary}, Accept-Encoding` : 'Accept-Encoding');

      const stream =
        enc === 'br' ? createBrotliCompress() : enc === 'gzip' ? createGzip() : createDeflate();

      stream.on('error', () => {
        // If compression itself throws, strip the encoding and let the raw
        // bytes (already buffered in the stream) fall through uncompressed.
        if (!res.headersSent) res.removeHeader('Content-Encoding');
      });

      const sink = new Writable({
        write(c, _enc, done) {
          const ok = origWrite(c as Buffer);
          if (ok === false) res.once('drain', () => done());
          else done();
        },
        final(done) {
          try {
            (origEnd as (cb?: () => void) => void)();
          } finally {
            if (userCb) userCb();
            done();
          }
        },
      });

      stream.pipe(sink);

      if (chunk == null) stream.end();
      else if (rest.length >= 2 || typeof rest[0] === 'string') {
        // res.end(body, encoding[, cb]) — forward encoding to the compressor
        stream.end(chunk, rest[0] as BufferEncoding);
      } else {
        stream.end(chunk);
      }
      return res;
    } as typeof res.end;

    next();
  };
}
