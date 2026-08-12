import { Request, Response, NextFunction, RequestHandler } from 'express';

/** Eliminates try/catch boilerplate in controllers (AGENTS.md Clause 2.5). */
export const asyncHandler = (fn: RequestHandler): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
