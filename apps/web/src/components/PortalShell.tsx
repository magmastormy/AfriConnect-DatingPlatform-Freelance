'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth, isAdmin } from '@/lib/auth';
import { useClerkIdentity } from '@/lib/useClerkIdentity';
import { useClerkSignOut } from '@/app/clerk-provider';
import { stageLabel } from '@/lib/membership';

interface NavItem {
  href: string;
  label: string;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const GROUPS: NavGroup[] = [
  {
    title: 'Explore',
    items: [
      { href: '/portal/discover', label: 'Discover' },
      { href: '/portal/matches', label: 'Matches' },
      { href: '/portal/events', label: 'Events' },
      { href: '/portal/messages', label: 'Messages' },
    ],
  },
  {
    title: 'Your account',
    items: [
      { href: '/portal', label: 'Dashboard' },
      { href: '/portal/account', label: 'Account' },
    ],
  },
];

const WIDE_ROUTES = ['/portal/settings', '/portal/account', '/portal/messages'];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { user, loading, stage, logout } = useAuth();
  const { user: clerkUser, isLoaded: clerkLoaded } = useClerkIdentity();
  const clerkSignOut = useClerkSignOut();
  const router = useRouter();
  const pathname = usePathname();
  const [navOpen, setNavOpen] = useState(false);

  const isWide = WIDE_ROUTES.some((r) => pathname === r || pathname.startsWith(`${r}/`));

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && isAdmin(user.role)) router.replace('/admin');
  }, [loading, user, router]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  async function handleSignOut() {
    try {
      if (clerkSignOut) await clerkSignOut();
    } catch {
      /* ignore — backend logout still attempted below */
    }
    try {
      await logout();
    } catch {
      /* ignore — redirect happens regardless */
    } finally {
      if (typeof window !== 'undefined') window.location.href = '/login';
    }
  }

  if (loading || !clerkLoaded)
    return (
      <div className="state">
        <span className="spinner" />
      </div>
    );
  if (!user) return null;

  const displayName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') ||
    user.email?.split('@')[0] ||
    'Member';
  const isActive = (href: string) =>
    href === '/portal' ? pathname === '/portal' : pathname.startsWith(href);

  return (
    <div className="portal-shell">
      <aside className={`portal-nav ${navOpen ? 'is-open' : ''}`}>
        <div className="portal-brand">
          <span className="portal-brand-mark">A</span>
          <span className="portal-brand-name">
            Member <em>Portal</em>
          </span>
          <button
            className="portal-close"
            onClick={() => setNavOpen(false)}
            aria-label="Close menu"
            type="button"
          >
            ×
          </button>
        </div>

        <div className="portal-id">
          {clerkUser?.imageUrl ? (
            <img className="portal-avatar" src={clerkUser.imageUrl} alt="" />
          ) : (
            <div className="portal-avatar portal-avatar-fallback">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="portal-id-meta">
            <span className="portal-id-name">{displayName}</span>
            <span className="portal-id-stage">{stageLabel(stage)}</span>
          </div>
        </div>

        <nav className="portal-links">
          {GROUPS.map((group) => (
            <div key={group.title} className="portal-group">
              <span className="portal-group-title">{group.title}</span>
              {group.items.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setNavOpen(false)}
                  className={`portal-link ${isActive(l.href) ? 'is-active' : ''}`}
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <button className="portal-signout" onClick={handleSignOut}>
          Sign out
        </button>
      </aside>

      <main className={`portal-content ${isWide ? 'is-wide' : ''}`}>
        <div className="portal-content-inner">
          <button
            className="portal-menu-btn"
            onClick={() => setNavOpen(true)}
            aria-label="Open menu"
            type="button"
          >
            <span aria-hidden="true">☰</span> Menu
          </button>
          {children}
        </div>
      </main>
      {navOpen && <div className="portal-backdrop" onClick={() => setNavOpen(false)} />}
    </div>
  );
}
