import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import type { NextRequest, NextFetchEvent } from 'next/server';

/**
 * Edge middleware.
 *
 * Clerk is the primary auth provider. When it is enabled (the publishable key
 * is configured) this middleware:
 *   - installs Clerk's session/cookies on every request,
 *   - redirects unauthenticated visitors away from member-only surfaces
 *     (/portal/*, /onboarding, /sign-out-internal) to /sign-in,
 *   - redirects authenticated visitors away from the auth screens to /portal.
 *
 * When Clerk is NOT configured (NEXT_PUBLIC_AUTH_MODE=otp or no key) the
 * middleware is a no-op pass-through, so the OTP fallback keeps working in
 * local/dev without a Clerk tenant. The protected routes are still enforced
 * server-side by the API's authorize()/requireVetted() middleware regardless
 * of which auth mode is active.
 */

const isEnabled =
  process.env.NEXT_PUBLIC_AUTH_MODE !== 'otp' &&
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY);

const protectedRoutes = createRouteMatcher(['/portal/:path*', '/onboarding', '/sign-out-internal']);

const authScreens = createRouteMatcher(['/sign-in', '/sign-up']);

const adminAuthRoutes = createRouteMatcher(['/admin/login', '/admin/setup']);

export default clerkMiddleware(async (auth, req: NextRequest, _event: NextFetchEvent) => {
  // Admin portal has its OWN auth (email+password, separate from Clerk). Never invoke Clerk there.
  if (adminAuthRoutes(req)) return NextResponse.next();
  if (!isEnabled) return NextResponse.next();

  const { userId, redirectToSignIn } = await auth();

  if (protectedRoutes(req) && !userId) {
    return redirectToSignIn({ returnBackUrl: req.url });
  }

  if (authScreens(req) && userId) {
    return NextResponse.redirect(new URL('/portal/discover', req.url));
  }

  // Signed-in visitors load straight into the app — "/" previously rendered
  // the marketing landing under a logged-in navbar (reported UX bug). The
  // same target as the post-sign-in redirect keeps one canonical entry.
  if (userId && req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/portal/discover', req.url));
  }

  return NextResponse.next();
});

export const config = {
  // Run on everything except Next internals and static files.
  // '/__clerk/:path*' is required by Clerk's auto-proxy (Clerk setup Step 4).
  matcher: ['/((?!_next|.*\\..*).*)', '/', '/__clerk/:path*'],
};
