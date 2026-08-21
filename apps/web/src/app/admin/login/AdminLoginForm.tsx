'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/adminAuth';
import { AdminApiError } from '@/lib/adminApi';
import { Button } from '@/components/ui';

export function AdminLoginForm() {
  const router = useRouter();
  const { login } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.push('/admin');
      router.refresh();
    } catch (e) {
      const msg = e instanceof AdminApiError ? e.message : e instanceof Error ? e.message : 'Sign in failed';
      setErr(msg);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="vet-card" style={{ display: 'grid', gap: 14 }}>
      {err && <div className="notice">{err}</div>}
      <label className="field">
        <span>Admin email</span>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
          placeholder="admin@afri-connect.co.za"
        />
      </label>
      <label className="field">
        <span>Password</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.currentTarget.value)}
          placeholder="••••••••"
        />
      </label>
      <Button type="submit" disabled={busy || !email || !password}>
        {busy ? 'Signing in…' : 'Sign in as admin'}
      </Button>
      <p className="vet-hint">Rate-limited 5 attempts / 15 min per email. Use a strong password.</p>
    </form>
  );
}
