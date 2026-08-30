'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import {
  api,
  ApiError,
  getAccessToken,
  setTokens,
  clearTokens,
  getRefreshToken,
  warmApi,
} from './api';
import { UserRole, UserStatus, ApplicationStatus } from '@/lib/shared';
import { MembershipStage, membershipStage } from '@/lib/membership';

export interface AuthUser {
  userId: string;
  role: UserRole;
  email: string;
  status: UserStatus;
}

interface AuthContextValue {
  user: AuthUser | null;
  /**
   * True only while the AfriConnect API session is being established.
   *
   * Deliberately does NOT wait on the vetting application: `stage` errs toward
   * the restricted reading while that is in flight, so nothing has to block on
   * it. Gating first paint on it used to add a serial round trip to every
   * portal navigation.
   */
  loading: boolean;
  /** Vetting state of the signed-in member's application, if any. */
  applicationStatus: ApplicationStatus | null;
  /** Derived capability stage. Drives every gate in the portal UI. */
  stage: MembershipStage;
  /** Set when the session could not be established after all retries. */
  sessionError: string | null;
  /** Re-runs the bootstrap after a failure (wired to the error state's retry). */
  retrySession: () => void;
  /**
   * Lets the Clerk session bridge report that the token exchange gave up, so
   * the shell can show an honest error instead of an endless spinner.
   */
  failSession: (message: string) => void;
  login: (access: string, refresh: string, user: AuthUser) => void;
  /** Clears backend tokens. Clerk sign-out is layered on top by useSignOut(). */
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Re-reads the application status, e.g. right after submitting one. */
  refreshApplication: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Upper bound on how long the shell will wait for the session before letting
 * the UI proceed. Without this a hung backend left `loading` true forever and
 * the portal rendered a permanent spinner.
 */
const BOOTSTRAP_TIMEOUT_MS = 20000;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [bootNonce, setBootNonce] = useState(0);
  // Guards against a slow bootstrap resolving after sign-out and resurrecting
  // the previous member's session in the UI.
  const loggedOut = useRef(false);

  /**
   * Loads the caller's vetting application. A 404 is the expected answer for a
   * member who has not applied yet and must not be treated as an error.
   */
  const loadApplication = useCallback(async () => {
    try {
      const app = await api.get<{ status: ApplicationStatus }>('/applications/me');
      setApplicationStatus(app.status);
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setApplicationStatus(null);
        return;
      }
      // Any other failure leaves the status unknown; gating then errs toward
      // the more restricted reading rather than unlocking anything.
      setApplicationStatus(null);
    }
  }, []);

  const bootstrap = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      // No stored session yet — the Clerk bridge will exchange for one. This is
      // a normal state, not an error, so it must not surface a failure.
      setLoading(false);
      return;
    }
    try {
      // Kick the vetting lookup off alongside the session read rather than
      // after it — they are independent and this used to be a serial waterfall
      // of two cross-region round trips on every page load.
      const applicationTask = loadApplication();
      const me = await api.get<{ user: AuthUser }>('/auth/me');
      if (loggedOut.current) return;
      setUser(me.user);
      setSessionError(null);
      // Awaited only so a pending request cannot outlive the provider; the UI
      // is already unblocked by the setUser above.
      await applicationTask;
    } catch {
      clearTokens();
      if (loggedOut.current) return;
      setUser(null);
      setSessionError('We could not reach AfriConnect. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, [loadApplication]);

  useEffect(() => {
    // Start absorbing any backend cold start now, in parallel with Clerk's own
    // script load and handshake, instead of paying for it later inside the
    // session exchange.
    warmApi();

    let cancelled = false;
    const guard = window.setTimeout(() => {
      if (cancelled) return;
      // Never let a hung backend pin the shell on a spinner forever. Releasing
      // `loading` lets the page render its own empty/error state.
      setLoading(false);
      setSessionError((prev) =>
        prev ?? 'AfriConnect is taking longer than usual to respond.',
      );
    }, BOOTSTRAP_TIMEOUT_MS);

    void bootstrap().finally(() => window.clearTimeout(guard));

    return () => {
      cancelled = true;
      window.clearTimeout(guard);
    };
  }, [bootstrap, bootNonce]);

  /** Re-runs the bootstrap after a failed session (surface-level retry). */
  const retrySession = useCallback(() => {
    setSessionError(null);
    setLoading(true);
    setBootNonce((n) => n + 1);
  }, []);

  const failSession = useCallback((message: string) => {
    setSessionError(message);
    setLoading(false);
  }, []);

  const login = useCallback(
    (access: string, refresh: string, u: AuthUser) => {
      loggedOut.current = false;
      setTokens(access, refresh);
      setUser(u);
      setSessionError(null);
      setLoading(false);
      void loadApplication();
    },
    [loadApplication],
  );

  const logout = useCallback(async () => {
    loggedOut.current = true;
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await api.post('/auth/logout', { refreshToken: refresh });
      } catch {
        // Best-effort server-side revocation; local tokens are cleared either way.
      }
    }
    clearTokens();
    setUser(null);
    setApplicationStatus(null);
    setSessionError(null);
  }, []);

  const refreshSession = useCallback(async () => {
    const refresh = getRefreshToken();
    if (!refresh) return;
    try {
      const res = await api.post<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
        refreshToken: refresh,
      });
      // Rotation: persist the new refresh token (the old one is invalidated server-side).
      setTokens(res.accessToken, res.refreshToken);
      const me = await api.get<{ user: AuthUser }>('/auth/me');
      if (loggedOut.current) return;
      setUser(me.user);
      setSessionError(null);
    } catch {
      clearTokens();
      if (loggedOut.current) return;
      setUser(null);
    }
  }, []);

  const stage = membershipStage(user, applicationStatus);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        applicationStatus,
        stage,
        sessionError,
        retrySession,
        failSession,
        login,
        logout,
        refresh: refreshSession,
        refreshApplication: loadApplication,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function isAdmin(role: UserRole | undefined): boolean {
  if (!role) return false;
  return [
    UserRole.Admin,
    UserRole.AdminVetting,
    UserRole.AdminEvents,
    UserRole.AdminBilling,
    UserRole.AdminSupport,
    UserRole.AdminContent,
    UserRole.SuperAdmin,
  ].includes(role);
}
