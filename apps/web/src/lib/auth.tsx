'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, ApiError, getAccessToken, setTokens, clearTokens, getRefreshToken } from './api';
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
  loading: boolean;
  /** Vetting state of the signed-in member's application, if any. */
  applicationStatus: ApplicationStatus | null;
  /** Derived capability stage. Drives every gate in the portal UI. */
  stage: MembershipStage;
  login: (access: string, refresh: string, user: AuthUser) => void;
  /** Clears backend tokens. Clerk sign-out is layered on top by useSignOut(). */
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** Re-reads the application status, e.g. right after submitting one. */
  refreshApplication: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [applicationStatus, setApplicationStatus] = useState<ApplicationStatus | null>(null);

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
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<{ user: AuthUser }>('/auth/me');
      setUser(me.user);
      await loadApplication();
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [loadApplication]);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(
    (access: string, refresh: string, u: AuthUser) => {
      setTokens(access, refresh);
      setUser(u);
      void loadApplication();
    },
    [loadApplication],
  );

  const logout = useCallback(async () => {
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
      setUser(me.user);
    } catch {
      clearTokens();
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
