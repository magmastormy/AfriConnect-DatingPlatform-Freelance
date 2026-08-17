import { PortalShell } from '@/components/PortalShell';

// Auth-gated, SSR-driven surface. Never statically prerender — Clerk context
// and the membership gate must resolve per request, which also avoids the
// "usePathname useContext null" error that occurs when App Router navigation
// hooks are evaluated during static generation.
export const dynamic = 'force-dynamic';

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return <PortalShell>{children}</PortalShell>;
}
