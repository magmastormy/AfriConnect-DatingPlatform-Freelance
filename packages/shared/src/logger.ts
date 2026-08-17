import pino from 'pino';

/**
 * Structured JSON logger (AGENTS.md Clause 2.7).
 * PII fields are redacted via the `redact` config.
 */
export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  base: { service: 'afri-connect', version: process.env.npm_package_version },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label.toUpperCase() }),
  },
  redact: {
    paths: [
      'password',
      '*.password',
      'req.headers.authorization',
      '*.otp',
      '*.idDocumentUrl',
      '*.degreeCertificateUrl',
      '*.selfieUrl',
      '*.proofOfWorkUrl',
    ],
    remove: true,
  },
});

/** Child logger scoped to a request correlation id (Clause 2.7). */
export const getRequestLogger = (correlationId: string) => logger.child({ correlationId });
