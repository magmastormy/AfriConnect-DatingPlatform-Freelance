'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { ApiState } from '@/components/ui';
import { AdminDashboard } from '@/lib/types';

export default function AdminDashboardPage() {
  const [data, setData] = useState<AdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setData(await api.get<AdminDashboard>('/admin/dashboard'));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const kpis = data
    ? [
        { v: data.applicationsPending, l: 'Applications pending' },
        { v: data.applicationsUnderReview, l: 'Under review' },
        { v: data.membersActive, l: 'Active members' },
        { v: data.membersSuspended, l: 'Suspended' },
        { v: data.eventsPublished, l: 'Events live' },
        { v: data.eventsDraft, l: 'Event drafts' },
        { v: `R${data.revenueZar.toLocaleString()}`, l: 'Revenue (ZAR)' },
        { v: `R${data.mrrZar.toLocaleString()}`, l: 'MRR (ZAR)' },
        { v: data.subscriptionsActive, l: 'Active subs' },
      ]
    : [];

  return (
    <div>
      <div className="page-head">
        <h1>Operations Dashboard</h1>
        <p>Real-time platform health across all scopes.</p>
      </div>
      <ApiState loading={loading} error={error}>
        <div className="kpis">
          {kpis.map((k) => (
            <div className="kpi" key={k.l}>
              <div className="v">{k.v}</div>
              <div className="l">{k.l}</div>
            </div>
          ))}
        </div>
      </ApiState>
    </div>
  );
}
