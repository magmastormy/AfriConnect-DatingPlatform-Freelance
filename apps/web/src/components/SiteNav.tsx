'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, isAdmin } from '@/lib/auth';
import { useOnline } from '@/lib/useOnline';
import { useToast } from '@/components/Toast';

export function SiteNav() {
  const { user, loading, logout } = useAuth();
  const online = useOnline();
  const toast = useToast();
  const router = useRouter();

  async function handleLogout() {
    await logout();
    toast('Signed out', 'info');
    router.push('/');
  }

  return (
    <nav className="nav" aria-label="Primary">
      <Link href="/" className="brand" aria-label="AfriConnect Professionals home">
        <span className="brand-mark" aria-hidden="true">
          A
        </span>
        <span className="brand-name">
          Afri<span>Connect</span>
        </span>
      </Link>

      <div className="links">
        <span className={`conn ${online ? 'conn-online' : 'conn-offline'}`} aria-hidden="true">
          <span className="conn-dot" />
        </span>
        {loading ? (
          <span className="spinner" aria-label="Loading session" />
        ) : user ? (
          <>
            {isAdmin(user.role) ? (
              <Link className="navlink" href="/admin" prefetch>
                Admin
              </Link>
            ) : (
              <Link className="navlink" href="/portal" prefetch>
                Portal
              </Link>
            )}
            <button className="btn btn-subtle" onClick={handleLogout}>
              Sign out
            </button>
          </>
        ) : (
          <>
            <Link className="navlink" href="/apply" prefetch>
              Apply
            </Link>
            <Link className="navlink" href="/auth" prefetch>
              Sign in
            </Link>
            <Link className="btn btn-primary nav-cta" href="/apply" prefetch>
              Get vetted
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
