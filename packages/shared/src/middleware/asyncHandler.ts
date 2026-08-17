import { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Eliminates try/catch boilerplate in controllers (AGENTS.md Clause 2.5).
 *
 * The handler parameter is typed to also accept an async function (returning
 * `Promise<void>`), not just a sync `RequestHandler`. Without this, every
 * `asyncHandler(async (req, res) => …)` call site trips
 * `@typescript-eslint/no-misused-promises` (a promise is being passed where a
 * void-returning handler is expected). Any rejection is forwarded to Express's
 * error middleware via `next`.
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void> | void,
): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
};
