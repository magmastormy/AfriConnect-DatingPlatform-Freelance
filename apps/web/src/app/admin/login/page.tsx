import type { Metadata } from 'next';
import { AdminLoginForm } from './AdminLoginForm';

export const metadata: Metadata = {
  title: 'Admin — Sign in',
  description: 'AfriConnect admin portal. Separate from member sign-in.',
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return (
    <div className="vet" style={{ maxWidth: 480 }}>
      <div className="vet-head">
        <p className="kicker">AfriConnect · Admin</p>
        <h1>Admin sign in</h1>
        <p>Separate from member sign-in (Clerk). Use your admin email and password.</p>
      </div>
      <AdminLoginForm />
      <p className="vet-hint" style={{ marginTop: 16, textAlign: 'center' }}>
        First admin? <a href="/admin/setup">Bootstrap with setup token</a> ·{' '}
        <a href="/">← Back to site</a>
      </p>
    </div>
  );
}
