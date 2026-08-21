'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAdminAuth, isAdminRole } from '@/lib/adminAuth';
import { GlobalSearch } from '@/components/GlobalSearch';
import { NotificationBell } from '@/components/NotificationBell';

const LINKS = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/applications', label: 'Applications' },
  { href: '/admin/members', label: 'Members' },
  { href: '/admin/subscriptions', label: 'Subscriptions' },
  { href: '/admin/events', label: 'Events' },
  { href: '/admin/broadcast', label: 'Broadcast' },
  { href: '/admin/audit', label: 'Audit Log' },
  { href: '/admin/roles', label: 'Roles' },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAdminAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isPublicAdminRoute = pathname === '/admin/login' || pathname === '/admin/setup';

  useEffect(() => {
    if (isPublicAdminRoute) return;
    if (!loading && !user) router.replace('/admin/login');
    if (!loading && user && !isAdminRole(user.role)) router.replace('/');
  }, [loading, user, router, isPublicAdminRoute]);

  if (isPublicAdminRoute) {
    return <>{children}</>;
  }

  if (loading)
    return (
      <div className="state">
        <span className="spinner" aria-label="Loading admin" />
      </div>
    );
  if (!user || !isAdminRole(user.role)) return null;

  return (
    <div className="admin-shell">
      <header className="admin-topbar">
        <GlobalSearch />
        <NotificationBell />
      </header>
      <div className="split">
        <aside className="card" style={{ position: 'sticky', top: 80 }}>
          <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Admin Console</h2>
          <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginBottom: '0.75rem' }}>
            Role: {user.role}
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className={`btn ${pathname === l.href ? 'btn-primary' : 'btn-subtle'}`}
                style={{ justifyContent: 'flex-start' }}
              >
                {l.label}
              </Link>
            ))}
          </nav>
          <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--line)', fontSize: '0.8rem', color: 'var(--muted)' }}>
            <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.email}</div>
            <button
              className="btn btn-ghost"
              style={{ marginTop: '0.5rem', width: '100%', justifyContent: 'center' }}
              onClick={async () => {
                await logout();
                router.replace('/admin/login');
              }}
            >
              Sign out
            </button>
          </div>
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
