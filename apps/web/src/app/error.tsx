'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // In production this would report to observability. Keep PII out of logs.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('Route error captured:', error.message);
    }
  }, [error]);

  return (
    <div className="card" style={{ maxWidth: 520, margin: '3rem auto', textAlign: 'center' }}>
      <h1>Something went wrong</h1>
      <p style={{ color: 'var(--muted)' }}>
        This page hit an unexpected error. Your data is safe — you can retry without losing
        progress.
      </p>
      <button className="btn btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
