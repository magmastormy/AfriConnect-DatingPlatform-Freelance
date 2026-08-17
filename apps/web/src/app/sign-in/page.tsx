import type { Metadata } from 'next';
import { AuthShell } from '@/components/AuthShell';
import { SignInForm } from './SignInForm';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to your AfriConnect Professionals account.',
  robots: { index: false, follow: false },
};

export default function SignInPage() {
  return (
    <AuthShell
      eyebrow="Members"
      title={
        <>
          Welcome <em>back</em>.
        </>
      }
      lede="Sign in to pick up your introductions, conversations and event invitations."
      aside={
        <dl className="auth-facts">
          <div>
            <dt>Vetted</dt>
            <dd>Every member is ID-, degree- and LinkedIn-checked by a human.</dd>
          </div>
          <div>
            <dt>Private</dt>
            <dd>POPIA-compliant. Your documents are encrypted and never shown publicly.</dd>
          </div>
        </dl>
      }
    >
      <SignInForm />
    </AuthShell>
  );
}
