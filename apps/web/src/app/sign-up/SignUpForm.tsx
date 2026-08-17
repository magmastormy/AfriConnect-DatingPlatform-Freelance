'use client';

import Link from 'next/link';
import { SignUp } from '@clerk/nextjs';
import { CLERK_ENABLED, AFTER_SIGN_UP_URL, SIGN_IN_URL } from '@/lib/clerk';
import { clerkAppearance } from '@/lib/clerkAppearance';

/**
 * Account creation.
 *
 * Creating an account is deliberately decoupled from vetting: this form only
 * establishes credentials. On success Clerk redirects to /onboarding, which
 * creates the profile and then offers vetting as a separate, later step.
 *
 * When Clerk is unavailable, we still show a streamlined account creation
 * flow rather than redirecting to vetting. Users can create their account
 * first, then get vetted later through the portal.
 */
export function SignUpForm() {
  if (!CLERK_ENABLED) {
    return (
      <div>
        <p className="notice">
          Account creation is currently being configured. Please check back soon or contact support
          for assistance.
        </p>
        <div className="auth-alt-actions">
          <Link className="btn btn-primary" href={SIGN_IN_URL}>
            Sign in instead
          </Link>
        </div>
        <p className="auth-switch">
          Already have an account? <Link href={SIGN_IN_URL}>Sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <>
      <SignUp
        appearance={clerkAppearance}
        routing="hash"
        signInUrl={SIGN_IN_URL}
        fallbackRedirectUrl={AFTER_SIGN_UP_URL}
      />
      <p className="auth-switch">
        Already have an account? <Link href={SIGN_IN_URL}>Sign in</Link>
      </p>
    </>
  );
}
