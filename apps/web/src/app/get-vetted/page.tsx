import type { Metadata } from 'next';
import { OnboardingForm } from '../onboarding/OnboardingForm';

export const metadata: Metadata = {
  title: 'Get verified',
  description: 'Verify your professional identity to join the AfriConnect community.',
  robots: { index: false, follow: false },
};

export default function GetVettedPage() {
  return <OnboardingForm />;
}
