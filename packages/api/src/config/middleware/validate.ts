import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import { ValidationError } from '@africonnect/shared';

/**
 * Validates `req.body` against a Zod schema and replaces it with the parsed
 * (typed, coerced) value. Throws ValidationError on failure (Clause 3.3).
 */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(
        new ValidationError('Request validation failed', result.error.flatten().fieldErrors),
      );
    }
    req.body = result.data as unknown as Request['body'];
    next();
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(
        new ValidationError('Query validation failed', result.error.flatten().fieldErrors),
      );
    }
    req.query = result.data as unknown as Request['query'];
    next();
  };
}
