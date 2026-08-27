'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Badge } from '@/components/ui';
import type { NotificationView } from '@/lib/types';
import { useNotifications } from '@/lib/notifications';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function typeIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes('match')) return '♡';
  if (t.includes('message') || t.includes('chat')) return '✉';
  if (t.includes('event')) return '◷';
  if (t.includes('like') || t.includes('super')) return '★';
  if (t.includes('vet') || t.includes('verif')) return '✓';
  if (t.includes('system') || t.includes('admin')) return '⚙';
  return '◐';
}

export function NotificationBell() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuth();
  const isAdminRoute = pathname?.startsWith('/admin');
  // hide for guests on public routes; show for members or on admin routes
  if (!user && !isAdminRoute) return null;
  if (isAdminRoute) return <FallbackBell />;

  let ctx: ReturnType<typeof useNotifications> | null = null;
  try { ctx = useNotifications(); } catch { ctx = null; }
  // fallback if provider missing (should not happen for members, but admin uses same bell without provider)
  if (!ctx) return <FallbackBell />;

  const { count, items, loading, open, setOpen, markRead, markAllRead } = ctx;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onEsc); };
  }, [open, setOpen]);

  function openNotification(n: NotificationView) {
    markRead(n.id);
    // Always close: a link-less notification used to leave the popover open
    // with no feedback beyond the read-state flip, which read as "broken".
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="notif-bell" ref={ref}>
      <button className="notif-bell-btn" onClick={() => setOpen(!open)} aria-label={`Notifications ${count > 0 ? `(${count} unread)` : ''}`} aria-expanded={open} aria-haspopup="dialog">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
          <path d="M4 8a1 1 0 0 1 1-1" opacity="0" />
        </svg>
        {count > 0 && <span className="notif-bell-badge">{count > 99 ? '99+' : count}</span>}
      </button>

      {open && (
        <div className="notif-popover" role="dialog" aria-label="Notifications">
          <div className="notif-popover-head">
            <strong>Notifications</strong>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {count > 0 && <span className="badge badge-warn">{count} new</span>}
              <button className="btn btn-ghost" style={{ minHeight: 32, padding: '0 10px', fontSize: '.78rem' }} onClick={() => setOpen(false)} aria-label="Close">×</button>
            </div>
          </div>

          <div className="notif-popover-actions">
            {count > 0 && <button className="btn btn-subtle" style={{ minHeight: 32, fontSize: '.78rem' }} onClick={markAllRead}>Mark all read</button>}
            <a href="/portal/notifications" className="btn btn-ghost" style={{ minHeight: 32, fontSize: '.78rem' }} onClick={() => setOpen(false)}>View all</a>
          </div>

          <div className="notif-list">
            {loading && <div className="state" style={{ padding: '1.2rem' }}><span className="spinner" /> Loading…</div>}
            {!loading && items.length === 0 && <div className="state" style={{ padding: '1.4rem' }}>You’re all caught up. New matches, messages and events will appear here.</div>}
            {!loading && items.map((n) => (
              <button key={n.id} className={`notif-item ${n.isRead ? '' : 'unread'} ${n.link ? 'has-cta' : ''}`} onClick={() => openNotification(n)}>
                <span className={`notif-item-icon ${n.isRead ? '' : 'unread'}`} aria-hidden>{typeIcon(n.type)}</span>
                <span className="notif-item-main">
                  <span className="notif-title">
                    <span className="notif-title-text">{n.title}</span>
                    <Badge tone={n.isRead ? 'neutral' : 'warn'}>{n.type}</Badge>
                  </span>
                  <span className="notif-body">{n.body}</span>
                  <span className="notif-foot">
                    <span className="notif-time">{timeAgo(n.createdAt)}</span>
                    {n.link && <span className="notif-cta">Open →</span>}
                  </span>
                </span>
                {!n.isRead && <span className="notif-unread-dot" aria-hidden />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// fallback for admin shell where provider may not wrap — local polling
function FallbackBell() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState<NotificationView[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    let alive = true;
    const load = () => { void api.unreadNotificationCount().then((r) => { if (alive) setCount(r.count); }).catch(() => {}); };
    load();
    const t = window.setInterval(load, 20000);
    return () => { alive = false; window.clearInterval(t); };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      try { setItems(await api.listNotifications()); } catch { /* ignore */ } finally { setLoading(false); }
    }
  }

  async function openNotification(n: NotificationView) {
    // mark read locally
    setItems((p) => p.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
    setCount((c) => Math.max(0, c - 1));
    void api.markNotificationRead(n.id).catch(() => {});
    setOpen(false);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="notif-bell" ref={ref}>
      <button className="notif-bell-btn" onClick={toggle} aria-label="Notifications">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11" />
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
        </svg>
        {count > 0 && <span className="notif-bell-badge">{count > 99 ? '99+' : count}</span>}
      </button>
      {open && (
        <div className="notif-popover">
          <div className="notif-popover-head"><strong>Notifications</strong><button className="btn btn-ghost" style={{ minHeight: 32 }} onClick={() => setOpen(false)}>×</button></div>
          <div className="notif-list">
            {loading && <div className="state">Loading…</div>}
            {!loading && items.length === 0 && <div className="state">All caught up.</div>}
            {!loading && items.map((n) => (
              <button key={n.id} className={`notif-item ${n.isRead ? '' : 'unread'}`} onClick={() => openNotification(n)}>
                <span className="notif-item-icon">{typeIcon(n.type)}</span>
                <span className="notif-item-main">
                  <span className="notif-title">{n.title}</span>
                  <span className="notif-body">{n.body}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
