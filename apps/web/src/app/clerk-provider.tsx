'use client';

import {
  ClerkProvider as ClerkBaseProvider,
  useAuth as useClerkAuth,
  useClerk,
  useUser,
} from '@clerk/nextjs';
import React, { createContext, useContext, useEffect, useRef } from 'react';
import { exchangeClerkToken } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CLERK_ENABLED, CLERK_PUBLISHABLE_KEY } from '@/lib/clerk';

/**
 * Clerk integration.
 *
 * Clerk owns the credential lifecycle (sign-in, sign-up, sign-out, MFA, social
 * providers). AfriConnect still owns authorization: once a Clerk session
 * exists, the Clerk session JWT is exchanged once for our own access/refresh
 * pair via POST /auth/clerk/exchange, and everything downstream keeps using the
 * AfriConnect AuthUser. That keeps the API contract and role model unchanged.
 *
 * Two contexts are published here:
 *   - ClerkSignOutContext: exposes Clerk's signOut ONLY when a provider is
 *     mounted. Consumers (the nav) can therefore sign out correctly without
 *     calling Clerk's own useClerk(), which throws when no provider exists —
 *     the OTP fallback mode has no provider.
 */

type ClerkSignOutFn = (() => Promise<void>) | null;

const ClerkSignOutContext = createContext<ClerkSignOutFn>(null);

/** Returns Clerk's signOut when Clerk is mounted, else null. Never throws. */
export function useClerkSignOut(): ClerkSignOutFn {
  return useContext(ClerkSignOutContext);
}

/**
 * Publishes Clerk's signOut into our own context. Rendered inside
 * ClerkBaseProvider, so useClerk() is guaranteed to have a provider here.
 */
function ClerkSignOutBridge({ children }: { children: React.ReactNode }) {
  const clerk = useClerk();
  const signOut = React.useCallback(async () => {
    await clerk.signOut();
  }, [clerk]);
  return <ClerkSignOutContext.Provider value={signOut}>{children}</ClerkSignOutContext.Provider>;
}

/**
 * Exchanges the Clerk session for AfriConnect tokens.
 *
 * Guarded by a ref keyed on the Clerk session id so a re-render, a token
 * refresh or a `user` object change cannot trigger a second exchange for the
 * same session (which would rotate refresh tokens needlessly).
 */
function ClerkSessionBridge() {
  const { isSignedIn, sessionId, getToken } = useClerkAuth();
  const { isLoaded: userLoaded } = useUser();
  const { user: appUser, login } = useAuth();
  const exchangedFor = useRef<string | null>(null);

  useEffect(() => {
    if (!isSignedIn || !userLoaded || !sessionId) return;
    // Already have an AfriConnect session for this Clerk session.
    if (exchangedFor.current === sessionId) return;
    if (appUser && exchangedFor.current === null) {
      // A restored AfriConnect session already covers this Clerk session
      // (page reload with valid tokens); adopt it without re-exchanging.
      exchangedFor.current = sessionId;
      return;
    }

    let active = true;
    void (async () => {
      try {
        const token = await getToken();
        if (!token || !active) return;
        const res = await exchangeClerkToken(token);
        if (!active || !res) return;
        exchangedFor.current = sessionId;
        login(res.accessToken, res.refreshToken, {
          userId: res.user.userId,
          email: res.user.email,
          role: res.user.role as never,
          status: res.user.status as never,
        });
      } catch {
        // Surfaced by downstream route guards; never log the token.
      }
    })();

    return () => {
      active = false;
    };
  }, [isSignedIn, userLoaded, sessionId, getToken, login, appUser]);

  return null;
}

export function ClerkProvider({ children }: { children: React.ReactNode }) {
  // Without a publishable key ClerkBaseProvider throws at runtime, so fall
  // back to the OTP flow rather than taking the whole app down.
  if (!CLERK_ENABLED || !CLERK_PUBLISHABLE_KEY) return <>{children}</>;

  return (
    <ClerkBaseProvider publishableKey={CLERK_PUBLISHABLE_KEY}>
      <ClerkSignOutBridge>
        <ClerkSessionBridge />
        {children}
      </ClerkSignOutBridge>
    </ClerkBaseProvider>
  );
}
