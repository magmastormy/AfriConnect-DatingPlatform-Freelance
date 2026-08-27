'use client';

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui';

/**
 * The "phone" side of the cross-device KYC flow in testing mode.
 *
 * The laptop renders a QR encoding /vetting/sandbox?session=<id>; scanning it
 * opens this page on the phone. Tapping "Complete verification" approves the
 * check locally, and the desktop (polling GET /vetting/smile/status) flips to
 * Verified. In live mode this page is never used — Smile ID hosts the capture.
 */
function VettingSandboxInner() {
  const params = useSearchParams();
  const sessionId = params.get('session') || '';
  const [doing, setDoing] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function complete() {
    setDoing(true);
    setErr(null);
    try {
      await api.completeVettingSandbox(sessionId);
      setDone(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not complete verification');
    } finally {
      setDoing(false);
    }
  }

  if (!sessionId) {
    return (
      <div className="vet">
        <div className="vet-card vet-status">
          <h1>Missing session</h1>
          <p>This simulator link is incomplete.</p>
          <div className="vet-actions vet-actions-center">
            <Link className="btn btn-primary" href="/get-vetted">
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (done) {
    return (
      <div className="vet">
        <div className="vet-card vet-status">
          <div className="vet-status-mark good" aria-hidden>
            Verified
          </div>
          <h1>Verified</h1>
          <p>Your ID check passed. Return to your laptop to continue — it updates automatically.</p>
          <div className="vet-actions vet-actions-center">
            <Link className="btn btn-primary" href="/portal">
              Go to portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vet">
      <div className="vet-card">
        <h2>Continue on this device</h2>
        <p className="vet-hint">
          You scanned the code from your laptop. This simulates the phone capturing your ID and a
          live selfie. Tap below to approve the check.
        </p>
        {err && <div className="notice">{err}</div>}
        <div className="vet-actions vet-actions-center">
          <Button onClick={complete} disabled={doing}>
            {doing ? 'Verifying…' : 'Complete verification'}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function VettingSandboxPage() {
  return (
    <Suspense
      fallback={
        <div className="state">
          <span className="spinner" aria-label="Loading" />
        </div>
      }
    >
      <VettingSandboxInner />
    </Suspense>
  );
}
