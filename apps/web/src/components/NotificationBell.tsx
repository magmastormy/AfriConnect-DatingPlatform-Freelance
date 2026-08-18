'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Badge } from '@/components/ui';
import type { NotificationView } from '@/lib/types';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell() {
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationView[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const refreshCount = () => {
    api
      .unreadNotificationCount()
      .then((r) => setCount(r.count))
      .catch(() => {});
  };

  useEffect(() => {
    refreshCount();
    const t = setInterval(refreshCount, 20000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try {
        setItems(await api.listNotifications());
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
  }

  async function markRead(id: string) {
    setItems((p) => p.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    setCount((c) => Math.max(0, c - 1));
    try {
      await api.markNotificationRead(id);
    } catch {
      /* ignore */
    }
  }

  /** Open a notification: mark it read, then navigate when it carries a link. */
  async function openNotification(n: NotificationView) {
    void markRead(n.id);
    if (n.link) {
      setOpen(false);
      router.push(n.link);
    }
  }

  async function markAll() {
    setItems((p) => p.map((n) => ({ ...n, isRead: true })));
    setCount(0);
    try {
      await api.markAllNotificationsRead();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="bell" ref={ref}>
      <button className="btn btn-subtle" onClick={toggle} aria-label="Notifications">
        Alerts
        {count > 0 && <span className="bell-count">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="popover">
          <div className="popover-head">
            <strong>Notifications</strong>
            {count > 0 && (
              <button className="btn btn-subtle" onClick={markAll}>
                Mark all read
              </button>
            )}
          </div>
          <div className="popover-body">
            {loading && <div className="state">Loading…</div>}
            {!loading && items.length === 0 && (
              <div className="state">You&apos;re all caught up.</div>
            )}
            {!loading &&
              items.map((n) => (
                <button
                  key={n.id}
                  className={`notif-item ${n.isRead ? '' : 'unread'} ${n.link ? 'has-cta' : ''}`}
                  onClick={() => openNotification(n)}
                >
                  <div className="notif-title">
                    {n.title}
                    <Badge tone={n.isRead ? 'neutral' : 'warn'}>{n.type}</Badge>
                  </div>
                  <div className="notif-body">{n.body}</div>
                  <div className="notif-foot">
                    <span className="notif-time">{timeAgo(n.createdAt)}</span>
                    {n.link && <span className="notif-cta">Open&nbsp;→</span>}
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
