import { Request, Response, NextFunction } from 'express';
import { isAppError, logger } from '../index';

/**
 * Centralized error handler (AGENTS.md Clause 2.6).
 * Operational errors return their status + message; everything else is an
 * InternalError with no stack leak in production.
 */
export const errorHandler = (
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void => {
  if (isAppError(err)) {
    logger.warn(
      {
        error: err.name,
        message: err.message,
        context: err.context,
        isOperational: err.isOperational,
      },
      'Operational error',
    );
    res.status(err.statusCode).json({
      success: false,
      data: null,
      meta: { timestamp: new Date().toISOString() },
      error: { code: err.name.toUpperCase(), message: err.message },
    });
    return;
  }

  logger.error({ error: (err as Error)?.message, stack: (err as Error)?.stack }, 'Unhandled error');
  const status = 500;
  const message =
    process.env.NODE_ENV === 'development'
      ? (err as Error)?.message
      : 'An unexpected error occurred';
  res.status(status).json({
    success: false,
    data: null,
    meta: { timestamp: new Date().toISOString() },
    error: { code: 'INTERNAL_ERROR', message },
  });
};
