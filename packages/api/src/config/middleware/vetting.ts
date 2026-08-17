import { Request, Response, NextFunction } from 'express';
import {
  AuthorizationError,
  AuthenticationError,
  UserRole,
  UserStatus,
  isAdminRole,
} from '@africonnect/shared';

/**
 * Vetting gate (AGENTS.md Clause 5 auth).
 *
 * The product rule is account-first: a member signs up, gets a working but
 * LIMITED account, and only unlocks the social surfaces once the vetting team
 * approves them. Profile editing is deliberately NOT behind this gate so an
 * applicant can keep tuning their profile while under review.
 *
 * This is the authoritative enforcement point. The web app mirrors the same
 * rules for rendering, but that is presentation only — every gated route must
 * mount this middleware or the restriction is not real.
 *
 * Must be mounted AFTER authorize(), which populates req.user.
 */

/** Roles considered fully vetted members. Admins pass implicitly. */
const VETTED_ROLES: UserRole[] = [UserRole.Member, UserRole.Premium];

export function requireVetted() {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const user = req.user;
    if (!user) {
      // authorize() was not mounted ahead of this middleware; refuse rather
      // than silently allowing the request through.
      return next(new AuthenticationError('Authentication required'));
    }

    if (user.status === UserStatus.Suspended || user.status === UserStatus.Banned) {
      return next(new AuthorizationError('This account is restricted'));
    }

    // Staff need access to the same surfaces for moderation and support.
    if (isAdminRole(user.role)) return next();

    if (!VETTED_ROLES.includes(user.role) || user.status !== UserStatus.Active) {
      return next(
        new AuthorizationError(
          'Your membership is not yet verified. Complete vetting to unlock this feature.',
          { stage: 'unvetted' },
        ),
      );
    }

    next();
  };
}
