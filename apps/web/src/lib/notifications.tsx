'use client';

import React, { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import type { NotificationView } from '@/lib/types';

interface NotifContext {
  count: number;
  items: NotificationView[];
  loading: boolean;
  refresh: () => Promise<void>;
  markRead: (id: string) => void;
  markAllRead: () => void;
  open: boolean;
  setOpen: (v: boolean) => void;
}

const Ctx = createContext<NotifContext | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationView[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const pollRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!user) { setCount(0); setItems([]); return; }
    try {
      const r = await api.unreadNotificationCount();
      setCount(r.count);
    } catch { /* ignore when unauthed */ }
    if (open) {
      setLoading(true);
      try {
        const list = await api.listNotifications();
        setItems(list);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }
  }, [user, open]);

  // poll count every 20s when logged in
  useEffect(() => {
    void refresh();
    if (!user) return;
    const id = window.setInterval(() => {
      void api.unreadNotificationCount().then((r) => setCount(r.count)).catch(() => {});
      if (open) void api.listNotifications().then(setItems).catch(() => {});
    }, 20000);
    pollRef.current = id;
    return () => window.clearInterval(id);
  }, [user, open, refresh]);

  // when dropdown opens, fetch list
  useEffect(() => {
    if (open && user) {
      setLoading(true);
      void api.listNotifications().then(setItems).catch(() => {}).finally(() => setLoading(false));
    }
  }, [open, user]);

  const markRead = useCallback((id: string) => {
    setItems((prev) => prev.map((n) => n.id === id ? { ...n, isRead: true } : n));
    setCount((c) => Math.max(0, c - 1));
    void api.markNotificationRead(id).catch(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setCount(0);
    void api.markAllNotificationsRead().catch(() => {});
  }, []);

  return (
    <Ctx.Provider value={{ count, items, loading, refresh, markRead, markAllRead, open, setOpen }}>
      {children}
    </Ctx.Provider>
  );
}

export function useNotifications() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useNotifications must be inside NotificationProvider');
  return v;
}

export function useNotificationCount() {
  const v = useContext(Ctx);
  return v?.count ?? 0;
}
