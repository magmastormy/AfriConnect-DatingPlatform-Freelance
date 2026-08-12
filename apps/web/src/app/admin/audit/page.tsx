'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card, ApiState, Badge } from '@/components/ui';

interface AuditEntry {
  id: string;
  adminId: string;
  action: string;
  entity: string;
  entityId: string | null;
  scope: string;
  metadata: unknown;
  ipAddress: string | null;
  createdAt: string;
}

export default function AuditPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setEntries(await api.get<AuditEntry[]>('/admin/audit'));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load audit log');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <div className="page-head">
        <h1>Audit Log</h1>
        <p>
          Immutable record of every administrative action, by scope and actor (POPIA compliance).
        </p>
      </div>
      <ApiState loading={loading} error={error} empty={entries.length === 0}>
        <Card>
          <table className="table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Admin</th>
                <th>Scope</th>
                <th>Action</th>
                <th>Entity</th>
                <th>IP</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td>{new Date(e.createdAt).toLocaleString()}</td>
                  <td>{e.adminId.slice(0, 8)}</td>
                  <td>
                    <Badge tone="neutral">{e.scope}</Badge>
                  </td>
                  <td>{e.action}</td>
                  <td>
                    {e.entity}
                    {e.entityId ? `:${e.entityId.slice(0, 8)}` : ''}
                  </td>
                  <td>{e.ipAddress ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </ApiState>
    </div>
  );
}
