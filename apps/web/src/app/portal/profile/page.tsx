import { redirect } from 'next/navigation';

/**
 * Profile editing lives on the account page. This alias exists because the
 * vetting flow and capability gates point members at "refine my profile",
 * which reads more naturally as /portal/profile.
 */
export default function PortalProfileAliasPage() {
  redirect('/portal/account');
}
