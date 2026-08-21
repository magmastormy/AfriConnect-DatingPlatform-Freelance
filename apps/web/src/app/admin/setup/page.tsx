import type { Metadata } from 'next';
import { AdminSetupForm } from './AdminSetupForm';

export const metadata: Metadata = {
  title: 'Admin — Bootstrap',
  description: 'Create the first AfriConnect superadmin.',
  robots: { index: false, follow: false },
};

export default function AdminSetupPage() {
  return (
    <div className="vet" style={{ maxWidth: 520 }}>
      <div className="vet-head">
        <p className="kicker">AfriConnect · Admin setup</p>
        <h1>Create first superadmin</h1>
        <p>Only works once — when no admin exists. Requires ADMIN_SETUP_TOKEN from the server .env.</p>
      </div>
      <AdminSetupForm />
      <p className="vet-hint" style={{ marginTop: 16, textAlign: 'center' }}>
        Already have an admin? <a href="/admin/login">Sign in</a>
      </p>
    </div>
  );
}
