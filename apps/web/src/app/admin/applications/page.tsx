'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { ApiState, Button, Badge, Select, SearchInput, Pagination } from '@/components/ui';
import { ApplicationView } from '@/lib/types';
import { ApplicationStatus } from '@/lib/shared';

const PAGE_SIZE = 25;

export default function ApplicationsPage() {
  const [apps, setApps] = useState<ApplicationView[]>([]);
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
        const list = await api.get<ApplicationView[]>(
          '/admin/applications' + (filter ? `?status=${filter}` : ''),
        );
        setApps(list);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [filter]);

  const filtered = useMemo(() => {
    if (!search) return apps;
    return apps.filter((a) =>
      `${a.firstName} ${a.lastName} ${a.email} ${a.profession} ${a.city}`
        .toLowerCase()
        .includes(search),
    );
  }, [apps, search]);

  const pageItems = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  );

  async function review(id: string, status: ApplicationStatus) {
    setBusyId(id);
    try {
      await api.post(`/admin/applications/${id}/review`, { status });
      setApps((p) => p.filter((a) => a.id !== id));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Review failed');
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
          placeholder="Search name, email, profession…"
        />
        <Select label="Filter" value={filter} onChange={(e) => setFilter(e.currentTarget.value)}>
          <option value="">All</option>
          {Object.values(ApplicationStatus).map((s) => (
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
                <th>Name</th>
                <th>Email</th>
                <th>City</th>
                <th>Profession</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((a) => (
                <tr key={a.id}>
                  <td>
                    {a.firstName} {a.lastName}
                  </td>
                  <td>{a.email}</td>
                  <td>{a.city}</td>
                  <td>{a.profession}</td>
                  <td>
                    <Badge
                      tone={
                        a.status === ApplicationStatus.Approved
                          ? 'good'
                          : a.status === ApplicationStatus.Rejected
                            ? 'bad'
                            : 'warn'
                      }
                    >
                      {a.status}
                    </Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <Button
                        disabled={busyId === a.id}
                        onClick={() => review(a.id, ApplicationStatus.Approved)}
                      >
                        Approve
                      </Button>
                      <Button
                        variant="danger"
                        disabled={busyId === a.id}
                        onClick={() => review(a.id, ApplicationStatus.Rejected)}
                      >
                        Reject
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
