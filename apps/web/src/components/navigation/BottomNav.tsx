'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
import type { SuperlikesReceivedView, UnreadCount } from '@/lib/types';
import './BottomNav.css';

interface NavItem {
  href: string;
  label: string;
  icon: 'home' | 'compass' | 'heart' | 'chat' | 'cal';
  badge?: 'likes' | 'unread';
}

const ITEMS: NavItem[] = [
  { href: '/portal', label: 'Home', icon: 'home' },
  { href: '/portal/discover', label: 'Discover', icon: 'compass' },
  { href: '/portal/matches', label: 'Matches', icon: 'heart', badge: 'likes' },
  { href: '/portal/messages', label: 'Chats', icon: 'chat', badge: 'unread' },
  { href: '/portal/events', label: 'Events', icon: 'cal' },
];

function NavIcon({ kind, active }: { kind: NavItem['icon']; active: boolean }) {
  const fill = active ? 'currentColor' : 'none';
  switch (kind) {
    case 'home':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 10L12 3l9 7v10a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5H10v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />
        </svg>
      );
    case 'compass':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7} aria-hidden>
          <circle cx="12" cy="12" r="9" />
          <path d="M15.5 8.5l-4 2.5 2.5 4 4-2.5z" fill={active ? 'currentColor' : 'none'} stroke="currentColor" />
        </svg>
      );
    case 'heart':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={active ? 2 : 1.7} aria-hidden>
          <path d="M12 21s-6.5-4.2-8.2-8.2A4.8 4.8 0 0 1 12 5a4.8 4.8 0 0 1 8.2 7.8C18.5 16.8 12 21 12 21z" />
        </svg>
      );
    case 'chat':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M21 11.5a8.5 8.5 0 0 1-13.2 7.1L3 21l2.4-4.8A8.5 8.5 0 1 1 21 11.5z" />
        </svg>
      );
    case 'cal':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 2 : 1.7} aria-hidden>
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" />
        </svg>
      );
  }
}

export function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [likes, setLikes] = useState(0);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    // The portal chrome paints as soon as Clerk's handshake resolves, which is
    // well before the Clerk session has been exchanged for an AfriConnect
    // access token. The shell gates the page tree on the session, but this nav
    // bar is chrome and deliberately is not — so firing these on mount would
    // 401 on every fresh load (and again on every focus/poll tick).
    if (!user) {
      setLikes(0);
      setUnread(0);
      return;
    }
    let alive = true;
    const load = async () => {
      try {
        const [s, u] = await Promise.all([
          api.getSuperlikesReceived().catch(() => ({ items: [], count: 0 })),
          api.getChatUnreadCount().catch(() => ({ count: 0 })),
        ]);
        if (!alive) return;
        setLikes((s as SuperlikesReceivedView).count);
        setUnread((u as UnreadCount).count);
      } catch {}
    };
    void load();
    const poll = setInterval(() => void load(), 30_000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    window.addEventListener('visibilitychange', onFocus);
    return () => {
      alive = false;
      clearInterval(poll);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener('visibilitychange', onFocus);
    };
  }, [user]);

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {ITEMS.map((it) => {
        const active = it.href === '/portal' ? pathname === '/portal' : pathname.startsWith(it.href);
        const badge = it.badge === 'likes' ? likes : it.badge === 'unread' ? unread : 0;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`bottom-nav-item ${active ? 'is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
            aria-label={it.label}
          >
            <span className="bottom-nav-icon-wrap">
              <NavIcon kind={it.icon} active={active} />
              {badge > 0 && (
                <span className="bottom-nav-badge" aria-label={`${badge} new`}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </span>
            <span className="bottom-nav-label">{it.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
