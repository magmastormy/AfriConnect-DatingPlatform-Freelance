'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import type { SuperlikesReceivedView, UnreadCount } from '@/lib/types';
import './BottomNav.css';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Which badge source feeds this item (omit for none). */
  badge?: 'likes' | 'unread';
}

const ITEMS: NavItem[] = [
  { href: '/portal/discover', label: 'Discover', icon: '◎' },
  { href: '/portal/matches', label: 'Matches', icon: '♡', badge: 'likes' },
  { href: '/portal/messages', label: 'Messages', icon: '✉', badge: 'unread' },
  { href: '/portal/events', label: 'Events', icon: '◷' },
];

/**
 * Mobile-only primary navigation. Sits above the desktop sidebar (which is
 * hidden on phones) and surfaces two live badges — pending superlikes received
 * (Matches) and aggregate unread messages (Messages) — refreshed on focus and
 * every 30s so a new like/superlike or message shows up without a reload.
 */
export function BottomNav() {
  const pathname = usePathname();
  const [likes, setLikes] = useState(0);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
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
      } catch {
        /* badges are best-effort — unvetted members simply stay at 0 */
      }
    };
    void load();
    const poll = setInterval(() => void load(), 30_000);
    const onFocus = () => void load();
    window.addEventListener('focus', onFocus);
    return () => {
      alive = false;
      clearInterval(poll);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {ITEMS.map((it) => {
        const active =
          pathname === it.href || (it.href !== '/portal' && pathname.startsWith(`${it.href}/`));
        const badge = it.badge === 'likes' ? likes : it.badge === 'unread' ? unread : 0;
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`bottom-nav-item ${active ? 'is-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            <span className="bottom-nav-icon" aria-hidden="true">
              {it.icon}
            </span>
            <span className="bottom-nav-label">{it.label}</span>
            {badge > 0 && (
              <span className="bottom-nav-badge" aria-label={`${badge} new`}>
                {badge > 99 ? '99+' : badge}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
