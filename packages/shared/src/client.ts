/**
 * Client-safe entry point for @africonnect/shared.
 *
 * The package's main barrel (./index.ts) re-exports server-only modules —
 * integrations/media (fs/path/cloudinary), crypto/pii (node crypto),
 * logger (pino), and middleware/* (express). Pulling that barrel into a
 * browser bundle breaks the build ("Can't resolve 'fs'").
 *
 * The web frontend only needs the domain enums/types and error classes, all
 * of which live in modules that are safe to ship to the browser. This entry
 * re-exports exactly those, and is aliased in for the Next.js *client* build
 * only (see apps/web/next.config.mjs). The server build keeps the full
 * barrel, so logger/integrations remain available to route handlers and the
 * API package.
 */

export * from './types';
export * from './errors/AppError';
