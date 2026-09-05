'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Badge, Card, ApiState, Button } from '@/components/ui';
import type { NotificationView } from '@/lib/types';
import { useNotifications } from '@/lib/notifications';

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const now = Date.now();
  const mins = Math.floor((now - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function typeIcon(type: string) {
  const t = type.toLowerCase();
  if (t.includes('match')) return 'M';
  if (t.includes('message') || t.includes('chat')) return 'C';
  if (t.includes('event')) return 'E';
  if (t.includes('like') || t.includes('super')) return 'L';
  if (t.includes('vet') || t.includes('verif')) return 'V';
  if (t.includes('system')) return 'S';
  return '·';
}

/** Backend type codes (mutual_match, vetting.approved…) are for machines —
 *  members get a friendly label, falling back to a prettified code for any
 *  future type this map doesn't know about. */
const TYPE_LABELS: Record<string, string> = {
  mutual_match: 'Match',
  superlike_received: 'Superlike',
  'vetting.submitted': 'Vetting',
  'vetting.pending': 'Vetting',
  'vetting.approved': 'Verified',
  'vetting.declined': 'Vetting',
};

function typeLabel(type: string): string {
  return (
    TYPE_LABELS[type.toLowerCase()] ??
    type.replace(/[._]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

const CHANNEL_LABELS: Record<string, string> = {
  in_app: 'In-app',
  email: 'Email',
  sms: 'SMS',
  push: 'Push',
};

function channelLabel(channel: string): string {
  return CHANNEL_LABELS[channel.toLowerCase()] ?? channel;
}

export default function NotificationsPage() {
  const router = useRouter();
  const { items: ctxItems, markRead, markAllRead } = useNotifications();
  const [items, setItems] = useState<NotificationView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [busy, setBusy] = useState(false);

  // prefer context items when available, but also fetch directly for full page freshness
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.listNotifications().then((list) => { if (alive) setItems(list); })
      .catch((e) => { if (alive) setError(e instanceof ApiError ? e.message : 'Failed to load'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  // keep in sync with context when it updates (polling)
  useEffect(() => {
    if (ctxItems.length) setItems(ctxItems);
  }, [ctxItems]);

  const filtered = useMemo(() => {
    if (filter === 'unread') return items.filter((n) => !n.isRead);
    return items;
  }, [items, filter]);

  const unread = items.filter((n) => !n.isRead).length;

  async function handleOpen(n: NotificationView) {
    if (!n.isRead) {
      setItems((prev) => prev.map((x) => x.id === n.id ? { ...x, isRead: true } : x));
      markRead(n.id);
    }
    if (n.link) router.push(n.link);
  }

  async function handleMarkAll() {
    setBusy(true);
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    markAllRead();
    try { await api.markAllNotificationsRead(); } catch {}
    finally { setBusy(false); }
  }

  return (
    <div className="notif-page">
      <div className="page-head" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1>Notifications</h1>
          <p>Matches, messages, superlikes and updates — most recent first.</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="badge badge-neutral">{items.length} total</span>
          {unread > 0 && <span className="badge badge-warn">{unread} unread</span>}
        </div>
      </div>

      <div className="notif-page-bar">
        <div className="notif-page-tabs">
          <button className={`notif-tab ${filter === 'all' ? 'is-on' : ''}`} onClick={() => setFilter('all')}>All</button>
          <button className={`notif-tab ${filter === 'unread' ? 'is-on' : ''}`} onClick={() => setFilter('unread')}>Unread {unread > 0 && `· ${unread}`}</button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="subtle" disabled={busy || unread === 0} onClick={handleMarkAll}>{busy ? 'Marking…' : 'Mark all read'}</Button>
          <Button variant="ghost" onClick={() => window.location.reload()}>Refresh</Button>
        </div>
      </div>

      <ApiState loading={loading} error={error} empty={filtered.length === 0} emptyText={filter === 'unread' ? 'No unread notifications — you’re caught up.' : 'No notifications yet. Activity will appear here.'}>
        <div className="notif-page-list">
          {filtered.map((n) => (
            <button key={n.id} className={`notif-page-item ${n.isRead ? '' : 'unread'}`} onClick={() => handleOpen(n)}>
              <span className="notif-page-icon" aria-hidden>{typeIcon(n.type)}</span>
              <span className="notif-page-main">
                <span className="notif-page-title">
                  {n.title}
                  <Badge tone={n.isRead ? 'neutral' : 'warn'}>{typeLabel(n.type)}</Badge>
                  {!n.isRead && <span className="notif-page-dot" aria-label="Unread" />}
                </span>
                <span className="notif-page-body">{n.body}</span>
                <span className="notif-page-foot">
                  <span className="notif-page-time">{timeAgo(n.createdAt)} · {channelLabel(n.channel)}</span>
                  {n.link && <span className="notif-page-cta">Open →</span>}
                </span>
              </span>
            </button>
          ))}
        </div>
      </ApiState>

      <Card title="How notifications work">
        <p style={{ color: 'var(--muted)', fontSize: '.92rem', margin: 0 }}>
          We notify you for new mutual matches, superlikes, messages, event RSVPs and account updates. In-app notifications are always free; email/push follow your notification preferences.
        </p>
        <div style={{ marginTop: 12, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <a href="/portal/settings" className="btn btn-subtle">Notification settings</a>
          <a href="/portal/messages" className="btn btn-ghost">Go to messages</a>
        </div>
      </Card>
    </div>
  );
}
