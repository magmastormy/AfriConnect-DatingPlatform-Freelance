'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  adminApi,
  getAdminAccessToken,
  setAdminTokens,
  clearAdminTokens,
  getAdminRefreshToken,
} from './adminApi';

export interface AdminUser {
  userId: string;
  role: string;
  email: string;
  status: string;
}

interface AdminAuthContextValue {
  user: AdminUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  bootstrap: (email: string, password: string, setupToken: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [loading, setLoading] = useState(true);

  const bootstrap = useCallback(async () => {
    const token = getAdminAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const me = await adminApi.me();
      setUser(me.user);
    } catch {
      clearAdminTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await adminApi.login(email, password);
    setAdminTokens(res.accessToken, res.refreshToken);
    setUser(res.user as unknown as AdminUser);
  }, []);

  const bootstrapAdmin = useCallback(
    async (email: string, password: string, setupToken: string) => {
      const res = await adminApi.bootstrap(email, password, setupToken);
      setAdminTokens(res.accessToken, res.refreshToken);
      setUser(res.user as unknown as AdminUser);
    },
    [],
  );

  const logout = useCallback(async () => {
    const refresh = getAdminRefreshToken();
    if (refresh) {
      try {
        await adminApi.logout(refresh);
      } catch {}
    }
    clearAdminTokens();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const refreshToken = getAdminRefreshToken();
    if (!refreshToken) return;
    try {
      const res = await adminApi.refresh(refreshToken);
      setAdminTokens(res.accessToken, res.refreshToken);
    } catch {
      clearAdminTokens();
      setUser(null);
    }
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{ user, loading, login, bootstrap: bootstrapAdmin, logout, refresh }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used within AdminAuthProvider');
  return ctx;
}

export function isAdminRole(role: string | undefined): boolean {
  if (!role) return false;
  return [
    'admin',
    'admin_vetting',
    'admin_events',
    'admin_billing',
    'admin_support',
    'admin_content',
    'superadmin',
  ].includes(role);
}
