'use client';

import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';
import { CLERK_ENABLED, AFTER_SIGN_IN_URL, SIGN_UP_URL } from '@/lib/clerk';
import { clerkAppearance } from '@/lib/clerkAppearance';
import { OtpSignIn } from './OtpSignIn';

/**
 * The credential form for signing in.
 *
 * Clerk's <SignIn /> is the real implementation. The OTP form is retained as a
 * fallback for deployments without Clerk credentials so local development and
 * CI still have a working sign-in path; it is never used when Clerk is
 * configured.
 */
export function SignInForm() {
  if (!CLERK_ENABLED) return <OtpSignIn />;

  return (
    <>
      <SignIn
        appearance={clerkAppearance}
        routing="hash"
        signUpUrl={SIGN_UP_URL}
        fallbackRedirectUrl={AFTER_SIGN_IN_URL}
      />
      <p className="auth-switch">
        New to AfriConnect? <Link href={SIGN_UP_URL}>Create an account</Link>
      </p>
    </>
  );
}
