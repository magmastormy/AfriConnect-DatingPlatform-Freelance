import { AdminShell } from '@/components/AdminShell';

// Auth-gated surface — SSR per request, never statically prerendered.
export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
