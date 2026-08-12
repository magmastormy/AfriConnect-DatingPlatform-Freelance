'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { ApiState, Button, Badge, Select } from '@/components/ui';
import { SubscriptionAdminView } from '@/lib/types';
import { SubscriptionStatus, SubscriptionPlan } from '@africonnect/shared';

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<SubscriptionAdminView[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.get<SubscriptionAdminView[]>(
          '/admin/subscriptions' + (filter ? `?status=${filter}` : ''),
        );
        setSubs(list);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [filter]);

  async function cancel(userId: string) {
    setBusyId(userId);
    try {
      await api.post(`/admin/subscriptions/${userId}/cancel`, { atPeriodEnd: true });
      setSubs((p) => p.map((s) => (s.userId === userId ? { ...s, cancelAtPeriodEnd: true } : s)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  }

  async function grant(userId: string) {
    setBusyId(userId);
    try {
      await api.post(`/admin/subscriptions/${userId}/grant`, {
        plan: SubscriptionPlan.Premium,
        months: 1,
      });
      const refreshed = await api.get<SubscriptionAdminView[]>(
        '/admin/subscriptions' + (filter ? `?status=${filter}` : ''),
      );
      setSubs(refreshed);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Grant failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Subscriptions</h1>
        <Select label="Filter" value={filter} onChange={(e) => setFilter(e.currentTarget.value)}>
          <option value="">All</option>
          {Object.values(SubscriptionStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <ApiState loading={loading} error={error} empty={subs.length === 0}>
        <table className="table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Plan</th>
              <th>Status</th>
              <th>Renews</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((s) => (
              <tr key={s.userId}>
                <td>{s.email}</td>
                <td>{s.plan}</td>
                <td>
                  <Badge tone={s.status === SubscriptionStatus.Active ? 'good' : 'warn'}>
                    {s.status}
                  </Badge>
                  {s.cancelAtPeriodEnd ? ' (canceling)' : ''}
                </td>
                <td>
                  {s.currentPeriodEnd ? new Date(s.currentPeriodEnd).toLocaleDateString() : '—'}
                </td>
                <td>
                  <div className="row-actions">
                    <Button
                      variant="ghost"
                      disabled={busyId === s.userId}
                      onClick={() => cancel(s.userId)}
                    >
                      Cancel
                    </Button>
                    <Button disabled={busyId === s.userId} onClick={() => grant(s.userId)}>
                      Grant +1mo
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ApiState>
    </div>
  );
}
