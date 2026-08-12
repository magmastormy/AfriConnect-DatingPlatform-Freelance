'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { Button, Input } from '@/components/ui';
import { validateEmail, validatePhone, validateOneTimeCode } from '@/lib/validate';
import { CLERK_ENABLED } from '@/lib/clerk';

// Lazy-load Clerk's hosted <SignIn/> so it stays out of the initial bundle
// (only fetched when the auth route actually renders it). It must mount inside
// <ClerkProvider>, which the layout provides when Clerk is enabled.
const ClerkSignIn = dynamic(() => import('@clerk/nextjs').then((m) => m.SignIn), {
  ssr: false,
  loading: () => <p style={{ color: 'var(--muted)' }}>Loading sign-in…</p>,
});

type Mode = 'signin' | 'forgot';

const ADMIN_ROLES = [
  'admin',
  'admin_vetting',
  'admin_events',
  'admin_billing',
  'admin_support',
  'admin_content',
  'superadmin',
];

export default function AuthPage() {
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<Mode>('signin');
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState('');

  async function requestOtp() {
    const e: Record<string, string> = {};
    const em = validateEmail(email);
    if (em) e.email = em;
    const ph = validatePhone(phone);
    if (ph) e.phone = ph;
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await api.post('/auth/request-otp', { email, phone });
      setSentTo(phone);
      setStep('verify');
      toast(
        mode === 'forgot' ? 'Code sent to recover access' : 'Code sent to your phone',
        'success',
      );
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Could not send code', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    const e: Record<string, string> = {};
    const c = validateOneTimeCode(code);
    if (c) e.code = c;
    setErrors(e);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const res = await api.post<{
        accessToken: string;
        refreshToken: string;
        user: { id: string; email: string; role: string; status: string };
      }>('/auth/verify-otp', { email, phone, code });
      login(res.accessToken, res.refreshToken, {
        userId: res.user.id,
        email: res.user.email,
        role: res.user.role as never,
        status: res.user.status as never,
      });
      toast('Signed in', 'success');
      if (ADMIN_ROLES.includes(res.user.role)) router.push('/admin');
      else router.push('/portal');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Invalid code', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="prose" style={{ paddingTop: '2.5rem', maxWidth: 460 }}>
      {CLERK_ENABLED ? (
        <ClerkSignIn />
      ) : (
        <>
          <h1 style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>
            {mode === 'signin' ? 'Welcome back' : 'Recover access'}
          </h1>
          <p style={{ color: 'var(--muted)', marginTop: 0 }}>
            {mode === 'signin'
              ? 'Sign in with the phone we verified at application.'
              : 'We will send a one-time code to your verified number to restore access.'}
          </p>

          <div className="tabs" style={{ marginBottom: '1.5rem' }}>
            <button
              data-active={mode === 'signin'}
              onClick={() => {
                setMode('signin');
                setStep('request');
              }}
            >
              Sign in
            </button>
            <button
              data-active={mode === 'forgot'}
              onClick={() => {
                setMode('forgot');
                setStep('request');
              }}
            >
              Forgot access
            </button>
          </div>

          <div className="card" style={{ marginBottom: '1rem' }}>
            {step === 'request' ? (
              <div>
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  className={errors.email ? 'input-error' : ''}
                  placeholder="you@company.com"
                />
                {errors.email && <div className="field-error">{errors.email}</div>}
                <Input
                  label="Phone"
                  value={phone}
                  onChange={(e) => setPhone(e.currentTarget.value)}
                  className={errors.phone ? 'input-error' : ''}
                  placeholder="+27..."
                />
                {errors.phone && <div className="field-error">{errors.phone}</div>}
                <Button onClick={requestOtp} disabled={busy || !email || !phone}>
                  {busy ? 'Sending…' : 'Send one-time code'}
                </Button>
              </div>
            ) : (
              <div>
                <p style={{ color: 'var(--muted)' }}>
                  Enter the code sent to <strong>{sentTo || phone}</strong>.
                </p>
                <Input
                  label="One-time code"
                  value={code}
                  onChange={(e) => setCode(e.currentTarget.value)}
                  className={errors.code ? 'input-error' : ''}
                  placeholder="123456"
                  inputMode="numeric"
                />
                {errors.code && <div className="field-error">{errors.code}</div>}
                <div className="row-actions">
                  <Button onClick={verifyOtp} disabled={busy || !code}>
                    {busy ? 'Verifying…' : 'Verify & sign in'}
                  </Button>
                  <Button variant="ghost" onClick={() => setStep('request')}>
                    Back
                  </Button>
                </div>
              </div>
            )}
          </div>

          <p style={{ color: 'var(--muted)', fontSize: '0.9rem', textAlign: 'center' }}>
            Not a member yet?{' '}
            <a href="/apply" style={{ fontWeight: 600 }}>
              Apply for membership
            </a>
            .
          </p>
        </>
      )}
    </div>
  );
}
