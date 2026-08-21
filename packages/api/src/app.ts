import express, { Express, Request, Response, NextFunction } from 'express';

// Stash the raw request bytes so signature-verified webhooks (e.g. Smile ID)
// can verify over the exact bytes the provider signed.
declare global {
  namespace Express {
    interface Request {
      rawBody?: Buffer;
    }
  }
}
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { errorHandler, success, NotFoundError } from '@africonnect/shared';
import { config } from './config';
import { rateLimitMiddleware } from './config/middleware';
import { honeypotMiddleware } from './config/middleware/honeypot';
import { buildAuthModule } from './modules/auth';
import { buildApplicationModule } from './modules/application';
import { buildProfileModule } from './modules/profile';
import { buildMatchModule } from './modules/match';
import { buildChatModule } from './modules/chat';
import { buildEventModule } from './modules/event';
import { buildNotificationModule } from './modules/notification';
import { buildBillingModule } from './modules/billing';
import { buildAdminModule } from './modules/admin';
import { buildAdminAuthModule } from './modules/adminAuth';
import { buildSettingsModule } from './modules/settings';
import { buildUploadModule } from './modules/upload';
import { buildAnalyticsModule } from './modules/analytics';
import { buildDiscoverModule } from './modules/discover';
import { buildVettingModule } from './modules/vetting';

/** Compose the Express application from module routers. */
export function createApp(): Express {
  const app = express();

  // Adversarial posture: never advertise the stack.
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind a reverse proxy / LB; needed for real client IP

  // Security & parsing — hardened helmet (Clause 3: no stack leak, HSTS, CSP)
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          objectSrc: ["'none'"],
          upgradeInsecureRequests: [],
        },
      },
      crossOriginEmbedderPolicy: false,
      hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    }),
  );
  // Strict CORS: whitelist only (no wildcard). In production this must be https://afri-connect.co.za + https://app.afri-connect.co.za
  app.use(
    cors({
      origin: (origin, cb) => {
        // Allow non-browser (no origin) and whitelisted
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
        return cb(new Error(`CORS blocked: ${origin} not whitelisted`), false);
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'X-Correlation-Id', 'X-Forwarded-For'],
      maxAge: 600,
    }),
  );
  app.use(
    express.json({
      limit: '12mb',
      verify: (req, _res, buf) => {
        (req as Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  ); // base64 image uploads ride in JSON bodies; raw bytes stashed for webhooks

  // Correlation id for structured tracing (Clause 2.7)
  app.use((req: Request, _res: Response, next: NextFunction) => {
    const cid =
      (req.headers['x-correlation-id'] as string) ||
      `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
    (req as Request & { correlationId?: string }).correlationId = cid;
    next();
  });

  // Bot/scanner trap: reject probing of well-known secrets/scanner paths with a
  // generic 403 before any real route is consulted.
  app.use(honeypotMiddleware());

  // Health (kept public; carries no version/environment detail)
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json(success({ status: 'ok' }));
  });
  // Platform healthcheck (Render/Fly) — fixed path, never mounts under the secret segment.
  app.get('/healthz', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  // Tiered global rate limit (Clause 3.4)
  app.use(rateLimitMiddleware());

  // Obfuscated, versioned API surface. The mount segment is a random secret in
  // production (API_MOUNT_PATH), so the real endpoints are not enumerable.
  const mount = `/${config.apiMountPath}/v1`;
  app.use(`${mount}/auth`, buildAuthModule());
  app.use(`${mount}/applications`, buildApplicationModule());
  app.use(`${mount}/profile`, buildProfileModule());
  app.use(`${mount}/matches`, buildMatchModule());
  app.use(`${mount}/chat`, buildChatModule());
  app.use(`${mount}/events`, buildEventModule());
  app.use(`${mount}/notifications`, buildNotificationModule());
  app.use(`${mount}/billing`, buildBillingModule());
  // Separate admin auth — public (login/bootstrap) must sit BEFORE the protected admin router
  app.use(`${mount}/admin/auth`, buildAdminAuthModule());
  app.use(`${mount}/admin`, buildAdminModule());
  app.use(`${mount}/settings`, buildSettingsModule());
  app.use(`${mount}/upload`, buildUploadModule());
  app.use(`${mount}/analytics`, buildAnalyticsModule());
  app.use(`${mount}/discover`, buildDiscoverModule());
  app.use(`${mount}/vetting`, buildVettingModule());

  // Served user uploads (chat images). Bounded by auth at the upload endpoint.
  app.use(
    '/uploads',
    express.static(path.join(process.cwd(), 'uploads'), {
      maxAge: '1h',
      index: false,
    }),
  );

  // Any unrecognised path (including guessed API roots other than the secret
  // mount) returns a generic 404 — never reveals which routes exist.
  // NOTE: must be NotFoundError (404). Using ValidationError here produced a
  // misleading 400 Bad Request for every unknown route, which broke client-side
  // `status === 404` branches and contradicted the contract above.
  app.use((req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError(`No route for ${req.method} ${req.path}`));
  });

  // Centralized error handler (Clause 2.6) — must be last
  app.use(errorHandler);

  return app;
}
