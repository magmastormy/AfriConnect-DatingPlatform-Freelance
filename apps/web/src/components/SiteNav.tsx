'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, isAdmin } from '@/lib/auth';
import { useOnline } from '@/lib/useOnline';
import { useToast } from '@/components/Toast';
import { useState, useEffect } from 'react';

export function SiteNav() {
  const { user, loading, logout } = useAuth();
  const online = useOnline();
  const toast = useToast();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [router.pathname]);

  // Close mobile menu when clicking outside
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

      {/* Desktop Links */}
      <div className="links desktop-links">
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
            <Link className="navlink" href="/auth" prefetch>
              Sign in
            </Link>
            <Link className="btn btn-primary nav-cta" href="/apply" prefetch>
              Get vetted
            </Link>
          </>
        )}
      </div>

      {/* Mobile Menu Button */}
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

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="mobile-menu-overlay active" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Mobile Menu */}
      <div className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="mobile-menu-content">
          <span className={`conn ${online ? 'conn-online' : 'conn-offline'}`} aria-hidden="true">
            <span className="conn-dot" />
          </span>
          {loading ? (
            <span className="spinner" aria-label="Loading session" />
          ) : user ? (
            <>
              {isAdmin(user.role) ? (
                <Link className="mobile-navlink" href="/admin" prefetch>
                  Admin
                </Link>
              ) : (
                <Link className="mobile-navlink" href="/portal" prefetch>
                  Portal
                </Link>
              )}
              <button className="mobile-btn btn btn-subtle" onClick={handleLogout}>
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link className="mobile-navlink" href="/auth" prefetch>
                Sign in
              </Link>
              <Link className="mobile-btn btn btn-primary nav-cta" href="/apply" prefetch>
                Get vetted
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
