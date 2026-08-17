'use client';

import { useUser as useClerkUserRaw } from '@clerk/nextjs';
import { CLERK_ENABLED } from './clerk';

interface SafeClerkUser {
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  email: string | null;
  imageUrl: string | null;
}

const EMPTY: { user: SafeClerkUser | null; isLoaded: boolean } = {
  user: null,
  isLoaded: true,
};

/**
 * Returns the signed-in Clerk user's identity without throwing in OTP-only
 * environments (where no ClerkProvider is mounted). CLERK_ENABLED is a build-
 * time constant, so the conditional hook call is stable across renders.
 */
export function useClerkIdentity(): { user: SafeClerkUser | null; isLoaded: boolean } {
  if (!CLERK_ENABLED) return EMPTY;
  const { user, isLoaded } = useClerkUserRaw();
  if (!isLoaded) return { user: null, isLoaded: false };
  return {
    user: user
      ? {
          firstName: user.firstName,
          lastName: user.lastName,
          fullName: user.fullName,
          email: user.primaryEmailAddress?.emailAddress ?? null,
          imageUrl: user.imageUrl,
        }
      : null,
    isLoaded: true,
  };
}
