import { redirect } from 'next/navigation';

/**
 * Legacy redirect. Vetting now happens in the portal after account creation.
 */
export default function GetVettedPage() {
  redirect('/onboarding');
}
