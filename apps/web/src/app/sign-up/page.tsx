import type { Metadata } from 'next';
import { AuthShell, VettingLedger } from '@/components/AuthShell';
import { SignUpForm } from './SignUpForm';

export const metadata: Metadata = {
  title: 'Create your account',
  description:
    'Create your AfriConnect Professionals account, build your profile, then get vetted.',
  robots: { index: true, follow: true },
};

export default function SignUpPage() {
  return (
    <AuthShell
      eyebrow="Join"
      title={
        <>
          Create your <em>account</em>.
        </>
      }
      lede="An account first, vetting second. Set up your credentials now, build your profile, and submit for verification when you are ready."
      aside={<VettingLedger activeStep={1} />}
    >
      <SignUpForm />
    </AuthShell>
  );
}
