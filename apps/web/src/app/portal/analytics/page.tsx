'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { getMyAnalytics, ApiError, type AnalyticsBundle, type Bucket } from '@/lib/api';
import { ApiState, Card } from '@/components/ui';
// Perf: defer chart hydration off main thread — analytics is not LCP, so dynamic + ssr:false shaves ~30k from initial bundle and TBT
const LineChart = dynamic(() => import('@/components/charts/LineChart').then((m) => m.LineChart), {
  ssr: false,
  loading: () => (
    <div
      style={{ height: 120, background: 'var(--surface-3)', borderRadius: 8 }}
      aria-hidden="true"
    />
  ),
});
const BarChart = dynamic(() => import('@/components/charts/BarChart').then((m) => m.BarChart), {
  ssr: false,
  loading: () => (
    <div
      style={{ height: 120, background: 'var(--surface-3)', borderRadius: 8 }}
      aria-hidden="true"
    />
  ),
});

type WindowDays = 7 | 30 | 90;
const WINDOWS: WindowDays[] = [7, 30, 90];

const METRICS: {
  key: keyof AnalyticsBundle['series'];
  label: string;
  kind: 'line' | 'bar';
}[] = [
  { key: 'profileViews', label: 'Profile views', kind: 'line' },
  { key: 'likesSent', label: 'Likes sent', kind: 'line' },
  { key: 'likesReceived', label: 'Likes received', kind: 'line' },
  { key: 'mutualMatches', label: 'Mutual matches', kind: 'bar' },
  { key: 'eventsRsvpd', label: 'Events RSVP’d', kind: 'bar' },
];

export default function AnalyticsPage() {
  const [win, setWin] = useState<WindowDays>(30);
  const [bundle, setBundle] = useState<AnalyticsBundle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    getMyAnalytics(win)
      .then((b) => {
        if (active) setBundle(b);
      })
      .catch((e) => {
        if (active) setError(e instanceof ApiError ? e.message : 'Failed to load analytics');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [win]);

  return (
    <div>
      <div className="page-head">
        <h1>Your analytics</h1>
        <p>How your profile is performing over time.</p>
      </div>

      <div className="tabs" style={{ marginBottom: '1rem' }}>
        {WINDOWS.map((w) => (
          <button key={w} data-active={win === w} onClick={() => setWin(w)}>
            {w} days
          </button>
        ))}
      </div>

      <ApiState loading={loading} error={error}>
        {bundle && (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '1rem',
            }}
          >
            {METRICS.map((m) => {
              const data: Bucket[] = bundle.series[m.key];
              const total = bundle.totals[m.key];
              return (
                <Card
                  key={m.key}
                  title={m.label}
                  action={<span className="badge badge-neutral">{total}</span>}
                >
                  {m.kind === 'line' ? (
                    <LineChart data={data} label={m.label} />
                  ) : (
                    <BarChart data={data} label={m.label} />
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </ApiState>
    </div>
  );
}
