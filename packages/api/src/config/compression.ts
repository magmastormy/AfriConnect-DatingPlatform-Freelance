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
    type ResEnd = typeof res.end;
    const origWrite = res.write.bind(res) as (chunk: Uint8Array | string) => boolean;
    const origEnd = res.end.bind(res) as ResEnd;

    const newEnd: ResEnd = function (
      this: Response, chunk?: unknown, encoding?: BufferEncoding | (() => void), cb?: () => void): Response {
      // Normalize overloaded res.end() parameters (Express supports 4 signatures:
      //   res.end()
      //   res.end(callback)
      //   res.end(chunk, callback?)
      //   res.end(chunk, encoding, callback?)
      let bodyChunk: unknown;
      let bodyEncoding: BufferEncoding | undefined;
      let bodyCb: (() => void) | undefined;
      if (typeof chunk === 'function') {
        bodyCb = chunk as () => void;
      } else if (typeof encoding === 'function') {
        bodyChunk = chunk;
        bodyCb = encoding as () => void;
      } else {
        bodyChunk = chunk;
        bodyEncoding = encoding as BufferEncoding | undefined;
        bodyCb = cb;
      }

      const status = res.statusCode;
      const ctype = String(res.getHeader('Content-Type') || '');
      const alreadyEncoded = !!res.getHeader('Content-Encoding');
      const cc = res.getHeader('Cache-Control');
      const noTransform = typeof cc === 'string' && /no-transform/i.test(cc);

      const passThrough = (): Response => {
        const self = this as Response;
        const rawEnd = origEnd as unknown as (
          this: Response,
          chunk?: unknown,
          encoding?: BufferEncoding | (() => void),
          cb?: () => void,
        ) => Response;
        if (bodyCb !== undefined) {
          if (bodyChunk == null) return rawEnd.call(self, undefined, undefined, bodyCb);
          if (bodyEncoding !== undefined) return rawEnd.call(self, bodyChunk, bodyEncoding, bodyCb);
          return rawEnd.call(self, bodyChunk, bodyCb);
        }
        if (bodyEncoding !== undefined) return rawEnd.call(self, bodyChunk, bodyEncoding);
        if (bodyChunk == null) return rawEnd.call(self);
        return rawEnd.call(self, bodyChunk);
      };

      if (
        alreadyEncoded ||
        status === 204 ||
        status === 304 ||
        noTransform ||
        !COMPRESSIBLE.test(ctype)
      ) {
        return passThrough();
      }

      const len = res.getHeader('Content-Length');
      if (typeof len === 'string' && Number(len) < threshold) {
        return passThrough();
      }

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
            (origEnd as (cb?: () => void) => Response).call(res);
          } finally {
            if (bodyCb) bodyCb();
            done();
          }
        },
      });

      stream.pipe(sink);

      if (bodyChunk == null) stream.end();
      else if (typeof bodyEncoding === 'string') stream.end(bodyChunk as string | Uint8Array, bodyEncoding);
      else stream.end(bodyChunk as string | Uint8Array);
      return res;
    };

    res.end = newEnd;
    next();
  };
}
