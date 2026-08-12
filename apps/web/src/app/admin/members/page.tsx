'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { ApiState, Button, Badge, Select } from '@/components/ui';
import { MemberView } from '@/lib/types';
import { UserStatus } from '@africonnect/shared';

export default function MembersPage() {
  const [members, setMembers] = useState<MemberView[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.get<MemberView[]>(
          '/admin/members' + (filter ? `?status=${filter}` : ''),
        );
        setMembers(list);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, [filter]);

  async function act(userId: string, action: 'suspend' | 'unsuspend' | 'ban' | 'unban' | 'verify') {
    setBusyId(userId);
    try {
      await api.post(`/admin/members/${userId}/${action}`, {});
      const refreshed = await api.get<MemberView[]>(
        '/admin/members' + (filter ? `?status=${filter}` : ''),
      );
      setMembers(refreshed);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Members</h1>
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
      </ApiState>
    </div>
  );
}
