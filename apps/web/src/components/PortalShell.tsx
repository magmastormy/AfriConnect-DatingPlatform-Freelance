'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth, isAdmin } from '@/lib/auth';
import { useClerkIdentity } from '@/lib/useClerkIdentity';
import { useClerkSignOut } from '@/app/clerk-provider';
import { stageLabel } from '@/lib/membership';
import { BottomNav } from '@/components/navigation/BottomNav';
import { NotificationBell } from '@/components/NotificationBell';

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

function IcoHome() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10L12 3l9 7v10a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1v-5H10v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M10 21v-5a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/></svg>; }
function IcoCompass() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-4 2.5 2.5 4 4-2.5z"/><circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/></svg>; }
function IcoHeart() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M12 21s-6.5-4.2-8.2-8.2A4.8 4.8 0 0 1 12 5a4.8 4.8 0 0 1 8.2 7.8C18.5 16.8 12 21 12 21z"/></svg>; }
function IcoChat() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M21 11.5a8.5 8.5 0 0 1-13.2 7.1L3 21l2.4-4.8A8.5 8.5 0 1 1 21 11.5z"/><path d="M8 12h8M8 9h8" opacity="0"/></svg>; }
function IcoCal() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><circle cx="12" cy="15" r="1" fill="currentColor" stroke="none"/></svg>; }
function IcoUser() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>; }
function IcoSettings() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.9 4.9l2.1 2.1M16.9 16.9l2.1 2.1M2 12h3M19 12h3M4.9 19l2.1-2.1M16.9 7l2.1-2.1"/></svg>; }
function IcoChart() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9"><path d="M4 19V9M10 19V5M16 19V13M22 19H2"/></svg>; }
function IcoBell() { return <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7-6 11-6 11s-6-4-6-11"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>; }

const GROUPS: NavGroup[] = [
  {
    title: 'Explore',
    items: [
      { href: '/portal/discover', label: 'Discover', icon: <IcoCompass /> },
      { href: '/portal/matches', label: 'Matches', icon: <IcoHeart /> },
      { href: '/portal/messages', label: 'Messages', icon: <IcoChat /> },
      { href: '/portal/events', label: 'Events', icon: <IcoCal /> },
    ],
  },
  {
    title: 'You',
    items: [
      { href: '/portal', label: 'Home', icon: <IcoHome /> },
      { href: '/portal/account', label: 'My Profile', icon: <IcoUser /> },
      { href: '/portal/analytics', label: 'Insights', icon: <IcoChart /> },
      { href: '/portal/notifications', label: 'Notifications', icon: <IcoBell /> },
      { href: '/portal/settings', label: 'Settings', icon: <IcoSettings /> },
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
  const isImmersiveDiscover = pathname === '/portal/discover';

  useEffect(() => {
    // Clerk can be authenticated a moment before its session bridge exchanges
    // the Clerk JWT for the AfriConnect API session. Do not redirect back to
    // sign-in during that short handoff or the app can enter a redirect loop.
    const waitingForClerkExchange = !loading && !user && clerkLoaded && Boolean(clerkUser);
    if (!loading && !user && clerkLoaded && !waitingForClerkExchange) {
      router.replace('/sign-in');
      return;
    }
    if (waitingForClerkExchange) {
      const timeout = window.setTimeout(() => router.replace('/sign-in'), 10000);
      return () => window.clearTimeout(timeout);
    }
    if (!loading && user && isAdmin(user.role)) router.replace('/admin');
  }, [loading, user, clerkLoaded, clerkUser, router]);

  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  // Lock body scroll when drawer open (iOS safe)
  useEffect(() => {
    if (navOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [navOpen]);

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
      <div className="state" style={{ minHeight: '60vh' }}>
        <span className="spinner" style={{ width: 22, height: 22 }} />
      </div>
    );
  if (!user)
    return (
      <div className="state" role="status" aria-live="polite">
        <span className="spinner" />
        <span className="sr-only">Completing sign-in</span>
      </div>
    );

  const displayName =
    [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ') ||
    user.email?.split('@')[0] ||
    'Member';
  const isActive = (href: string) =>
    href === '/portal' ? pathname === '/portal' : pathname.startsWith(href);

  return (
    <div className={`portal-shell ${isImmersiveDiscover ? 'is-immersive-discover' : ''}`}>
      {/* ── Left rail — Facebook-web: sticky card, icon + label ── */}
      <aside className={`portal-nav ${navOpen ? 'is-open' : ''}`} aria-label="Portal navigation">
        <div className="portal-brand">
          <span className="portal-brand-mark">A</span>
          <span className="portal-brand-name">Member <em>Portal</em></span>
          <button className="portal-close" onClick={() => setNavOpen(false)} aria-label="Close menu" type="button">×</button>
        </div>

        <div className="portal-id">
          {clerkUser?.imageUrl ? (
            <img className="portal-avatar" src={clerkUser.imageUrl} alt="" width={44} height={44} />
          ) : (
            <div className="portal-avatar portal-avatar-fallback">{displayName.charAt(0).toUpperCase()}</div>
          )}
          <div className="portal-id-meta">
            <span className="portal-id-name">{displayName}</span>
            <span className="portal-id-stage">{stageLabel(stage)}</span>
          </div>
          <span className="portal-id-dot" title="Online" aria-hidden />
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
                  <span className="portal-link-ico" aria-hidden>{l.icon}</span>
                  <span>{l.label}</span>
                </Link>
              ))}
            </div>
          ))}
        </nav>

        <button className="portal-signout" onClick={handleSignOut}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Sign out
        </button>
      </aside>

      <main className={`portal-content ${isWide ? 'is-wide' : ''}`}>
        {!isImmersiveDiscover && (
          <div className="portal-mobilebar">
            <button className="portal-menu-btn" onClick={() => setNavOpen(true)} aria-label="Open menu" type="button">
              <span className="portal-hamburger" aria-hidden><i/><i/><i/></span>
            </button>
            <span className="portal-mobile-title">AfriConnect</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <NotificationBell />
              <Link href="/portal/account" className="portal-mobile-avatar" aria-label="My profile">
                {clerkUser?.imageUrl ? <img src={clerkUser.imageUrl} alt="" /> : <span>{displayName.charAt(0).toUpperCase()}</span>}
              </Link>
            </span>
          </div>
        )}
        {children}
      </main>

      <BottomNav />
      {navOpen && <div className="portal-backdrop" onClick={() => setNavOpen(false)} aria-hidden />}
    </div>
  );
}
