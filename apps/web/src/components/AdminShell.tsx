'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { isAdmin } from '@/lib/auth';
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
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && !isAdmin(user.role)) router.replace('/portal');
  }, [loading, user, router]);

  if (loading)
    return (
      <div className="state">
        <span className="spinner" />
      </div>
    );
  if (!user) return null;

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
        </aside>
        <div>{children}</div>
      </div>
    </div>
  );
}
