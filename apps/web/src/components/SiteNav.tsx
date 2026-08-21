'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth, isAdmin } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { useSignOut } from '@/lib/useSignOut';
import { ThemeToggle } from '@/components/ThemeToggle';

export function SiteNav() {
  const { user, loading } = useAuth();
  const toast = useToast();
  const signOut = useSignOut();
  // usePathname is the App Router API. useRouter() has no `pathname` field —
  // reading it was a silent bug that broke the typecheck.
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  // Close the mobile menu whenever the route changes.
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleClickOutside = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.mobile-menu') && !target.closest('.mobile-menu-btn')) {
        setMobileMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [mobileMenuOpen]);

  // Signs out of BOTH Clerk and the AfriConnect session (see useSignOut).
  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut('/');
      toast('Signed out', 'info');
    } finally {
      setSigningOut(false);
    }
  }

  const homeHref = user ? (isAdmin(user.role) ? '/admin' : '/portal') : '/';
  const homeLabel = user && isAdmin(user.role) ? 'Admin' : 'Portal';

  return (
    <nav className="nav" aria-label="Primary">
      <Link href="/" className="brand" aria-label="AfriConnect Professionals home">
        <div className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="20" cy="20" r="18" fill="#16130F" />
            <path
              d="M12 28L20 12L28 28"
              stroke="#C2502E"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path d="M20 12V28" stroke="#C2502E" strokeWidth="2.5" strokeLinecap="round" />
            <circle cx="20" cy="20" r="3" fill="#C2502E" />
            <path
              d="M14 22C14 22 16 24 20 24C24 24 26 22 26 22"
              stroke="#B8893A"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="brand-name">
          Afri<span>Connect</span>
        </span>
      </Link>

      <div className="links desktop-links">
        <ThemeToggle />
        {loading ? (
          <span className="spinner" aria-label="Loading session" />
        ) : user ? (
          <>
            <Link className="navlink" href={homeHref} prefetch>
              {homeLabel}
            </Link>
            <button className="btn btn-subtle" onClick={handleSignOut} disabled={signingOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </>
        ) : (
          <>
            <Link className="navlink" href="/sign-in" prefetch>
              Sign in
            </Link>
            <Link className="btn btn-primary nav-cta" href="/sign-up" prefetch>
              Create account
            </Link>
          </>
        )}
      </div>

      <button
        className="mobile-menu-btn"
        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        aria-label="Toggle menu"
        aria-expanded={mobileMenuOpen}
      >
        <span className={`hamburger ${mobileMenuOpen ? 'open' : ''}`}>
          <span></span>
          <span></span>
          <span></span>
        </span>
      </button>

      {mobileMenuOpen && (
        <div className="mobile-menu-overlay active" onClick={() => setMobileMenuOpen(false)} />
      )}

      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-menu-content">
          <ThemeToggle />
          {loading ? (
            <span className="spinner" aria-label="Loading session" />
          ) : user ? (
            <>
              <Link className="mobile-navlink" href={homeHref} prefetch>
                {homeLabel}
              </Link>
              <Link className="mobile-navlink" href="/portal/profile" prefetch>
                My profile
              </Link>
              <button
                className="mobile-btn btn btn-subtle"
                onClick={handleSignOut}
                disabled={signingOut}
              >
                {signingOut ? 'Signing out…' : 'Sign out'}
              </button>
            </>
          ) : (
            <>
              <Link className="mobile-navlink" href="/sign-in" prefetch>
                Sign in
              </Link>
              <Link className="mobile-btn btn btn-primary" href="/sign-up" prefetch>
                Create account
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
