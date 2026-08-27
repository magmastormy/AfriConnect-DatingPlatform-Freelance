'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';

/**
 * OTP-mode complement to the middleware's "/" redirect: OTP sessions live in
 * sessionStorage, which edge middleware cannot read, so the landing page
 * forwards authenticated members to the portal after hydration. In Clerk mode
 * the middleware already redirects before paint and this renders nothing.
 */
export function LandingRedirect() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) router.replace('/portal/discover');
  }, [loading, user, router]);

  return null;
}
