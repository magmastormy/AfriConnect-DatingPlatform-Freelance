'use client';

import {
  ClerkProvider as ClerkBaseProvider,
  useAuth as useClerkAuth,
  useUser,
} from '@clerk/nextjs';
import { useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { CLERK_ENABLED } from '@/lib/clerk';

// When Clerk is the active auth mode, we mount <ClerkProvider> and, once a
// Clerk session exists, exchange the Clerk session token for AfriConnect backend
// tokens via POST /auth/clerk/exchange. This keeps the rest of the app (which
// depends on our AuthUser + access token) unchanged.
function ClerkSessionBridge() {
  const { isSignedIn, getToken } = useClerkAuth();
  const { user } = useUser();
  const { login } = useAuth();

  useEffect(() => {
    if (!isSignedIn) return;
    let active = true;
    (async () => {
      try {
        const token = await getToken();
        if (!token) return;
        const res = await api.post<{
          accessToken: string;
          refreshToken: string;
          user: { id: string; email: string; role: string; status: string };
        }>('/auth/clerk/exchange', { token });
        if (!active) return;
        login(res.accessToken, res.refreshToken, {
          userId: res.user.id,
          email: res.user.email,
          role: res.user.role as never,
          status: res.user.status as never,
        });
      } catch {
        /* surfaced by downstream guards */
      }
    })();
    return () => {
      active = false;
    };
  }, [isSignedIn, getToken, user, login]);

  return null;
}

export function ClerkProvider({ children }: { children: React.ReactNode }) {
  if (!CLERK_ENABLED) return <>{children}</>;
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    // Misconfigured but enabled — fall back to OTP rather than crashing.
    return <>{children}</>;
  }
  return (
    <ClerkBaseProvider publishableKey={publishableKey}>
      <ClerkSessionBridge />
      {children}
    </ClerkBaseProvider>
  );
}
