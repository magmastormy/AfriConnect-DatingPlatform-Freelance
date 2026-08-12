import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../jwt';
import { AuthedUser, UserRole, AuthenticationError, AuthorizationError } from '@africonnect/shared';

declare global {
  namespace Express {
    interface Request {
      user?: AuthedUser;
    }
  }
}

/**
 * Verifies the Bearer access token and attaches `req.user`.
 * Optionally restricts to specific roles. (AGENTS.md Clause 5 auth.)
 */
export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      return next(new AuthenticationError('Missing bearer token'));
    }
    const token = header.slice(7);
    try {
      const payload = verifyAccessToken(token);
      const user: AuthedUser = {
        userId: payload.sub,
        role: payload.role as UserRole,
        email: payload.email,
        status: payload.status as AuthedUser['status'],
      };
      if (roles.length && !roles.includes(user.role)) {
        return next(new AuthorizationError('Insufficient role'));
      }
      req.user = user;
      next();
    } catch {
      next(new AuthenticationError('Invalid or expired token'));
    }
  };
}
