'use client';

import React from 'react';

interface State {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error) {
    // In production this would report to observability. Keep PII out of logs;
    // only surface a stripped message client-side, never the raw stack.
    if (process.env.NODE_ENV !== 'production') {
      // eslint-disable-next-line no-console
      console.warn('UI error captured by boundary:', error.message);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="card" style={{ maxWidth: 560, margin: '3rem auto', textAlign: 'center' }}>
          <h2>Something went wrong</h2>
          <p style={{ color: 'var(--muted)' }}>
            The page encountered an unexpected error. Your data is safe. Please try again.
          </p>
          <button
            className="btn btn-primary"
            onClick={() => this.setState({ hasError: false, message: '' })}
          >
            Reload view
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
