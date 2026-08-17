import { redirect } from 'next/navigation';

/**
 * Legacy alias. The OTP page used to live here and is now consolidated into
 * /sign-in, which serves Clerk (or the OTP fallback) behind one URL.
 */
export default function AuthAliasPage() {
  redirect('/sign-in');
}
