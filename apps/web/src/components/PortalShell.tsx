'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useAuth, isAdmin } from '@/lib/auth';

const LINKS = [
  { href: '/portal', label: 'Dashboard' },
  { href: '/portal/discover', label: 'Discover' },
  { href: '/portal/matches', label: 'Matches' },
  { href: '/portal/events', label: 'Events' },
  { href: '/portal/messages', label: 'Messages' },
  { href: '/portal/account', label: 'Account' },
  { href: '/portal/settings', label: 'Settings' },
];

export function PortalShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace('/login');
    if (!loading && user && isAdmin(user.role)) router.replace('/admin');
  }, [loading, user, router]);

  if (loading)
    return (
      <div className="state">
        <span className="spinner" />
      </div>
    );
  if (!user) return null;

  return (
    <div className="split">
      <aside className="card" style={{ position: 'sticky', top: 80 }}>
        <h2 style={{ marginTop: 0, fontSize: '1rem' }}>Member Portal</h2>
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
  );
}
