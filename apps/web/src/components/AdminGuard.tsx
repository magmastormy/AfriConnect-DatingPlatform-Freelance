'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/adminAuth';

export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAdminAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace('/admin/login');
  }, [loading, user, router]);

  if (loading) {
    return (
      <div className="state">
        <span className="spinner" aria-label="Loading" />
      </div>
    );
  }
  if (!user) return null;
  return <>{children}</>;
}
