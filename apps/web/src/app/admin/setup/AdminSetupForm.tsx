'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/adminAuth';
import { AdminApiError } from '@/lib/adminApi';
import { Button } from '@/components/ui';

export function AdminSetupForm() {
  const router = useRouter();
  const { bootstrap } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await bootstrap(email.trim().toLowerCase(), password, token.trim());
      router.push('/admin');
      router.refresh();
    } catch (e) {
      const msg =
        e instanceof AdminApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Bootstrap failed';
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="vet-card" style={{ display: 'grid', gap: 14 }}>
      {err && <div className="notice">{err}</div>}
      <label className="field">
        <span>Superadmin email</span>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          placeholder="admin@afri-connect.co.za"
        />
      </label>
      <label className="field">
        <span>Password (≥8 chars)</span>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          placeholder="••••••••"
        />
      </label>
      <label className="field">
        <span>ADMIN_SETUP_TOKEN</span>
        <input
          type="password"
          required
          value={token}
          onChange={(e) => setToken(e.currentTarget.value)}
          placeholder="from server .env"
        />
      </label>
      <Button type="submit" disabled={busy || !email || !password || !token}>
        {busy ? 'Creating…' : 'Create superadmin'}
      </Button>
    </form>
  );
}
