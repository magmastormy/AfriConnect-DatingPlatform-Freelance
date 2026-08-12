'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, getAccessToken, setTokens, clearTokens, getRefreshToken } from './api';
import { UserRole, UserStatus } from '@africonnect/shared';

export interface AuthUser {
  userId: string;
  role: UserRole;
  email: string;
  status: UserStatus;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (access: string, refresh: string, user: AuthUser) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await api.get<{ user: AuthUser }>('/auth/me');
      setUser(me.user);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback((access: string, refresh: string, u: AuthUser) => {
    setTokens(access, refresh);
    setUser(u);
  }, []);

  const logout = useCallback(async () => {
    const refresh = getRefreshToken();
    if (refresh) {
      try {
        await api.post('/auth/logout', { refreshToken: refresh });
      } catch {
        /* ignore */
      }
    }
    clearTokens();
    setUser(null);
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

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh: refreshSession }}>
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
