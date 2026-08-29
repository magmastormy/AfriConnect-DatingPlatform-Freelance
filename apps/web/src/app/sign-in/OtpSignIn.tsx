'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { Button, Input } from '@/components/ui';
import { validateEmail, validatePhone, validateOneTimeCode } from '@/lib/validate';
import { isAdmin } from '@/lib/auth';
import { UserRole } from '@/lib/shared';

/**
 * Phone-OTP sign-in.
 *
 * This is the FALLBACK credential path, used only when Clerk has no
 * publishable key (local development, CI, self-hosted previews without Clerk
 * credentials). Clerk is the primary provider in every configured environment.
 * It is kept because dropping it would leave those environments with no way to
 * sign in at all.
 */
export function OtpSignIn() {
  const router = useRouter();
  const { login } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useState<'signin' | 'forgot'>('signin');
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
        user: { userId: string; email: string; role: string; status: string };
      }>('/auth/verify-otp', { email, phone, code });
      login(res.accessToken, res.refreshToken, {
        userId: res.user.userId,
        email: res.user.email,
        role: res.user.role as never,
        status: res.user.status as never,
      });
      toast('Signed in', 'success');
      router.push(isAdmin(res.user.role as UserRole) ? '/admin' : '/portal');
    } catch (err) {
      toast(err instanceof ApiError ? err.message : 'Invalid code', 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="tabs" style={{ marginBottom: '1.25rem' }}>
        <button
          type="button"
          data-active={mode === 'signin'}
          onClick={() => {
            setMode('signin');
            setStep('request');
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          data-active={mode === 'forgot'}
          onClick={() => {
            setMode('forgot');
            setStep('request');
          }}
        >
          Forgot access
        </button>
      </div>

      {step === 'request' ? (
        <div>
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.currentTarget.value)}
            className={errors.email ? 'input-error' : ''}
            placeholder="you@company.com"
            autoComplete="email"
          />
          {errors.email && <div className="field-error">{errors.email}</div>}
          <Input
            label="Phone"
            value={phone}
            onChange={(e) => setPhone(e.currentTarget.value)}
            className={errors.phone ? 'input-error' : ''}
            placeholder="+27..."
            autoComplete="tel"
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
            autoComplete="one-time-code"
          />
          {errors.code && <div className="field-error">{errors.code}</div>}
          <div className="row-actions">
            <Button onClick={verifyOtp} disabled={busy || !code}>
              {busy ? 'Verifying…' : 'Verify and sign in'}
            </Button>
            <Button variant="ghost" onClick={() => setStep('request')}>
              Back
            </Button>
          </div>
        </div>
      )}

      <p className="auth-switch">
        New to AfriConnect? <Link href="/sign-up">Create an account</Link>
      </p>
    </div>
  );
}
