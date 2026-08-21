'use client';

import { useEffect, useRef, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui';
import { QRCodeSVG } from 'qrcode.react';

interface SessionResult {
  sessionId: string;
  mode: string;
  hostedUrl: string;
}

/**
 * Cross-device KYC entry point. The member starts a session; we render a QR the
 * phone scans to continue the ID + selfie check elsewhere, then poll until the
 * backend flips them to Verified. In testing (no Smile keys) the QR opens our
 * own /vetting/sandbox simulator, which approves instantly.
 */
export function SmileVerify() {
  const { refresh } = useAuth();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<SessionResult | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function start() {
    setBusy(true);
    setErr(null);
    try {
      const r = await api.createVettingSession();
      setResult(r);
      pollRef.current = setInterval(() => {
        void (async () => {
          try {
            const s = await api.getVettingStatus();
            if (s.verified) {
              if (pollRef.current) clearInterval(pollRef.current);
              pollRef.current = null;
              await refresh();
            }
          } catch {
            /* transient; keep polling */
          }
        })();
      }, 2500);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not start verification');
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <div className="vet-card">
        <h2>Verify on your phone</h2>
        <p className="vet-hint">
          Scan this code with your phone camera to continue the ID check there — or open the link
          directly. We’ll update your status the moment it completes.
        </p>
        <div className="vet-scan">
          <div className="vet-qr">
            <QRCodeSVG value={result.hostedUrl} size={180} level="M" />
          </div>
          <div className="vet-linkrow">
            <a className="btn btn-primary" href={result.hostedUrl} target="_blank" rel="noreferrer">
              Open on phone
            </a>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => navigator.clipboard?.writeText(result.hostedUrl)}
            >
              Copy link
            </button>
          </div>
        </div>
        {result.mode === 'sandbox' && (
          <p className="vet-hint">Testing mode: the link opens a simulator that approves instantly.</p>
        )}
      </div>
    );
  }

  return (
    <div className="vet-card">
      <h2>Verify with your ID</h2>
      <p className="vet-hint">
        Fastest path: a quick ID + selfie check (liveness) right on your phone. No waiting for a
        human review.
      </p>
      {err && <div className="notice">{err}</div>}
      <div className="vet-actions">
        <Button onClick={start} disabled={busy}>
          {busy ? 'Starting…' : 'Start ID verification'}
        </Button>
      </div>
    </div>
  );
}
