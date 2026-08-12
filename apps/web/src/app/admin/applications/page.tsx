'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { ApiState, Button, Badge, Select } from '@/components/ui';
import { ApplicationView } from '@/lib/types';
import { ApplicationStatus } from '@africonnect/shared';

export default function ApplicationsPage() {
  const [apps, setApps] = useState<ApplicationView[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
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
      <div className="page-head">
        <h1>Applications</h1>
        <Select label="Filter" value={filter} onChange={(e) => setFilter(e.currentTarget.value)}>
          <option value="">All</option>
          {Object.values(ApplicationStatus).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>
      <ApiState loading={loading} error={error} empty={apps.length === 0}>
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
            {apps.map((a) => (
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
      </ApiState>
    </div>
  );
}
