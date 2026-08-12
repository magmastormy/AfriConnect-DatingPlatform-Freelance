'use client';

// Global error boundary — catches errors thrown in the root layout/navigation
// (including the <html>/<body> shell), so it must render its own document.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          background: '#fff7ed',
          color: '#1f2937',
          display: 'flex',
          minHeight: '100vh',
          alignItems: 'center',
          justifyContent: 'center',
          margin: 0,
        }}
      >
        <div style={{ maxWidth: 480, textAlign: 'center', padding: '2rem' }}>
          <h1 style={{ color: '#c2410c' }}>Unexpected error</h1>
          <p style={{ color: '#6b7280' }}>
            The application encountered a critical error
            {error.digest ? ` (ref: ${error.digest})` : ''}. Please reload to continue.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: '1rem',
              padding: '0.6rem 1.2rem',
              borderRadius: 8,
              border: 'none',
              background: '#c2410c',
              color: 'white',
              cursor: 'pointer',
            }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
