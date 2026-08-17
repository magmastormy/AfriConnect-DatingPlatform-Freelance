'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { ApiState, Button, Badge, Select, SearchInput, Pagination } from '@/components/ui';
import { MemberView } from '@/lib/types';
import { UserStatus } from '@/lib/shared';

const PAGE_SIZE = 25;

export default function MembersPage() {
  const [members, setMembers] = useState<MemberView[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Debounce the search box into the value that actually drives the query.
  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Any new filter/search returns to the first page.
  useEffect(() => {
    setPage(1);
  }, [search, filter]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const { items, total: t } = await api.listMembers({
          page,
          limit: PAGE_SIZE,
          search: search || undefined,
          status: filter || undefined,
        });
        if (!cancelled) {
          setMembers(items);
          setTotal(t);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof ApiError ? e.message : 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, search, page]);

  async function act(userId: string, action: 'suspend' | 'unsuspend' | 'ban' | 'unban' | 'verify') {
    setBusyId(userId);
    try {
      await api.post(`/admin/members/${userId}/${action}`, {});
      const { items, total: t } = await api.listMembers({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        status: filter || undefined,
      });
      setMembers(items);
      setTotal(t);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action failed');
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
          placeholder="Search name or city…"
        />
        <Select label="Filter" value={filter} onChange={(e) => setFilter(e.currentTarget.value)}>
          <option value="">All</option>
          {Object.values(UserStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <ApiState loading={loading} error={error} empty={members.length === 0}>
        <div className="table-scroll">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Verified</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id}>
                  <td>
                    {m.firstName ?? ''} {m.lastName ?? ''}
                  </td>
                  <td>{m.email}</td>
                  <td>{m.role}</td>
                  <td>
                    <Badge
                      tone={
                        m.status === UserStatus.Active
                          ? 'good'
                          : m.status === UserStatus.Banned
                            ? 'bad'
                            : 'warn'
                      }
                    >
                      {m.status}
                    </Badge>
                  </td>
                  <td>{m.emailVerified ? '✓' : '—'}</td>
                  <td>
                    <div className="row-actions">
                      {m.status === UserStatus.Active ? (
                        <Button
                          variant="ghost"
                          disabled={busyId === m.id}
                          onClick={() => act(m.id, 'suspend')}
                        >
                          Suspend
                        </Button>
                      ) : (
                        <Button disabled={busyId === m.id} onClick={() => act(m.id, 'unsuspend')}>
                          Unsuspend
                        </Button>
                      )}
                      {m.status === UserStatus.Banned ? (
                        <Button disabled={busyId === m.id} onClick={() => act(m.id, 'unban')}>
                          Unban
                        </Button>
                      ) : (
                        <Button
                          variant="danger"
                          disabled={busyId === m.id}
                          onClick={() => act(m.id, 'ban')}
                        >
                          Ban
                        </Button>
                      )}
                      <Button
                        variant="subtle"
                        disabled={busyId === m.id}
                        onClick={() => act(m.id, 'verify')}
                      >
                        Verify
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={page} total={total} limit={PAGE_SIZE} onPageChange={setPage} />
      </ApiState>
    </div>
  );
}
