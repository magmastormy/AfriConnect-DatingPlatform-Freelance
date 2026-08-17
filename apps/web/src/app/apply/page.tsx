import { redirect } from 'next/navigation';

/**
 * Legacy alias. Apply now redirects to sign-up since vetting happens
 * after account creation in the portal.
 */
export default function ApplyAliasPage() {
  redirect('/sign-up');
}
