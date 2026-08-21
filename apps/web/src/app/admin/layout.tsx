import { AdminShell } from '@/components/AdminShell';
import { AdminAuthProvider } from '@/lib/adminAuth';

// Separate admin auth — does NOT use Clerk. SSR per request, never statically prerendered.
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // /admin/login and /admin/setup are public — they render without the shell.
  // The shell itself guards the rest.
  return (
    <AdminAuthProvider>
      <AdminShell>{children}</AdminShell>
    </AdminAuthProvider>
  );
}
