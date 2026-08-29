'use client';

import { usePathname } from 'next/navigation';
import { useAuth, isAdmin } from '@/lib/auth';

/**
 * Public marketing footer.
 *
 * Hidden on portal and admin routes where app-specific navigation
 * (PortalShell, BottomNav, AdminShell) is rendered, preventing the
 * mobile double-scroll down into the marketing footer.
 */
export function SiteFooter() {
  const pathname = usePathname();
  const { user } = useAuth();

  // Never render the marketing footer in the member portal or admin panel
  if (pathname.startsWith('/portal') || pathname.startsWith('/admin')) {
    return null;
  }

  // If signed in member is browsing, hide marketing footer on mobile
  if (user && !isAdmin(user.role) && (pathname.startsWith('/get-vetted') || pathname.startsWith('/onboarding'))) {
    return null;
  }

  return (
    <footer className="lp-footer">
      <div className="lp-footer-inner">
        <div>
          <span className="lp-wordmark">AfriConnect</span>
          <p className="lp-footer-tag">
            A vetted community for highly educated African professionals.
          </p>
        </div>
        <nav className="lp-footer-cols" aria-label="Footer">
          <div>
            <h4>Product</h4>
            <a href="/discover">Discover</a>
            <a href="/matches">Matches</a>
            <a href="/events">Events</a>
          </div>
          <div>
            <h4>Company</h4>
            <a href="/contact">Contact</a>
            <a href="/privacy">Privacy & POPIA</a>
            <a href="/terms">Terms</a>
          </div>
          <div>
            <h4>Membership</h4>
            <a href="/sign-up">Create account</a>
            <a href="/sign-in">Sign in</a>
          </div>
        </nav>
      </div>
      <div className="lp-footer-base">
        <span>
          © {new Date().getFullYear()} AfriConnect Professionals. All rights reserved.
        </span>
        <span>Johannesburg · Cape Town · Nairobi</span>
      </div>
    </footer>
  );
}
