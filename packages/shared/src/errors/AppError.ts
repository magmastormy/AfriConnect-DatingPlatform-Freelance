/**
 * Hierarchical application error system (AGENTS.md Clause 2.1).
 * Never throw raw `Error` and never return `null` for failures.
 */
export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  /** true = expected/operational, false = bug that should page someone */
  abstract readonly isOperational: boolean;

  constructor(
    message: string,
    public readonly context?: Record<string, unknown>,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, new.target);
  }

  toJSON(): Record<string, unknown> {
    return {
      error: this.name,
      message: this.message,
      statusCode: this.statusCode,
      ...(process.env.NODE_ENV === 'development' && { stack: this.stack }),
    };
  }
}

export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly isOperational = true;
  readonly fieldErrors?: unknown;
  constructor(message: string, fieldErrors?: unknown, context?: Record<string, unknown>) {
    super(message, context);
    this.fieldErrors = fieldErrors;
  }
}

export class AuthenticationError extends AppError {
  readonly statusCode = 401;
  readonly isOperational = true;
}

export class AuthorizationError extends AppError {
  readonly statusCode = 403;
  readonly isOperational = true;
}

export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly isOperational = true;
}

export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly isOperational = true;
}

export class RateLimitError extends AppError {
  readonly statusCode = 429;
  readonly isOperational = true;
  constructor(message = 'Too many requests, please slow down', context?: Record<string, unknown>) {
    super(message, context);
  }
}

export class InternalError extends AppError {
  readonly statusCode = 500;
  readonly isOperational = false;
}

/** Type guard for the centralized error handler. */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
