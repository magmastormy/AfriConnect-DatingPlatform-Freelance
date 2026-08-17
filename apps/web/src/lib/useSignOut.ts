'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { useClerkSignOut } from '@/app/clerk-provider';

/**
 * Single sign-out entry point for the whole app.
 *
 * A session has two halves and both must be torn down:
 *   1. the AfriConnect refresh session (revoked server-side, tokens cleared), and
 *   2. the Clerk session (cleared through Clerk's client).
 *
 * Clearing only our tokens would leave the Clerk session alive, and
 * ClerkSessionBridge would immediately mint a fresh AfriConnect session — the
 * member would appear to never sign out. Order matters: revoke ours first
 * (while the refresh token is still present), then Clerk.
 *
 * useClerkSignOut() returns null when Clerk is not mounted (OTP fallback mode),
 * so this hook is safe to call from shared navigation in either auth mode.
 */
export function useSignOut(): (redirectTo?: string) => Promise<void> {
  const { logout } = useAuth();
  const clerkSignOut = useClerkSignOut();
  const router = useRouter();

  return useCallback(
    async (redirectTo = '/') => {
      await logout();

      if (clerkSignOut) {
        try {
          await clerkSignOut();
        } catch {
          // The local session is already gone; a failed Clerk call must not
          // trap the member in a half-signed-out state.
        }
      }

      router.push(redirectTo);
      // Ensures server components re-render against the now-anonymous session.
      router.refresh();
    },
    [logout, clerkSignOut, router],
  );
}
