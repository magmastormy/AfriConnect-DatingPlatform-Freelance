import type { Metadata } from 'next';
import { OnboardingForm } from './OnboardingForm';

export const metadata: Metadata = {
  title: 'Build your profile',
  description: 'Set up your AfriConnect profile before requesting verification.',
  robots: { index: false, follow: false },
};

export default function OnboardingPage() {
  return <OnboardingForm />;
}
