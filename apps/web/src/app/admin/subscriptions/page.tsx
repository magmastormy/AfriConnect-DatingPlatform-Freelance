'use client';

import { useEffect, useMemo, useState } from 'react';
import { adminApi, AdminApiError } from '@/lib/adminApi';
import { ApiState, Button, Badge, Select, SearchInput, Pagination } from '@/components/ui';
import { SubscriptionAdminView } from '@/lib/types';
import { SubscriptionStatus, SubscriptionPlan } from '@/lib/shared';

const PAGE_SIZE = 25;

export default function SubscriptionsPage() {
  const [subs, setSubs] = useState<SubscriptionAdminView[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim().toLowerCase()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  useEffect(() => {
    void (async () => {
      try {
        setSubs(await adminApi.listSubscriptions(filter || undefined));
      } catch (e) {
        setError(e instanceof AdminApiError ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [filter]);

  const filtered = useMemo(() => {
    if (!search) return subs;
    return subs.filter((s) => `${s.email} ${s.plan} ${s.status}`.toLowerCase().includes(search));
  }, [subs, search]);

  const pageItems = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  async function cancel(userId: string) {
    setBusyId(userId);
    try {
      await adminApi.cancelSubscription(userId, { atPeriodEnd: true });
      setSubs((p) => p.map((s) => (s.userId === userId ? { ...s, cancelAtPeriodEnd: true } : s)));
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  }

  async function grant(userId: string) {
    setBusyId(userId);
    try {
      await adminApi.grantSubscription(userId, {
        plan: SubscriptionPlan.Premium,
        months: 1,
      });
      setSubs(await adminApi.listSubscriptions(filter || undefined));
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Grant failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-head grid2">
        <SearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder="Search email, plan, status…"
        />
        <Select label="Filter" value={filter} onChange={(e) => setFilter(e.currentTarget.value)}>
          <option value="">All</option>
          {Object.values(SubscriptionStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <ApiState loading={loading} error={error} empty={filtered.length === 0}>
        <div className="table-scroll">
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
              {pageItems.map((s) => (
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
        </div>
        <Pagination page={page} total={filtered.length} limit={PAGE_SIZE} onPageChange={setPage} />
      </ApiState>
    </div>
  );
}
