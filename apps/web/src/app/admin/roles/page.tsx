'use client';

import { useEffect, useState } from 'react';
import { adminApi, AdminApiError } from '@/lib/adminApi';
import { Card, ApiState, Button, Badge, Select } from '@/components/ui';
import { RoleDescriptor } from '@/lib/types';
import { UserRole } from '@/lib/shared';

interface AdminUser {
  id: string;
  email: string;
  role: UserRole;
}

export default function RolesPage() {
  const [matrix, setMatrix] = useState<RoleDescriptor[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [assignId, setAssignId] = useState<string>('');
  const [assignRole, setAssignRole] = useState<UserRole>(UserRole.Admin);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const [r, a] = await Promise.all([adminApi.roleMatrix(), adminApi.listAdmins()]);
        setMatrix(r);
        setAdmins(a as unknown as AdminUser[]);
        if (a.length) setAssignId(a[0].id);
      } catch (e) {
        setError(e instanceof AdminApiError ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function assign() {
    setBusy(true);
    try {
      await adminApi.assignRole(assignId, { role: assignRole });
      setAdmins((await adminApi.listAdmins()) as unknown as AdminUser[]);
    } catch (e) {
      setError(e instanceof AdminApiError ? e.message : 'Assign failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Roles & Access</h1>
        <p>Split-team scope model. Super-admin only.</p>
      </div>
      <ApiState loading={loading} error={error}>
        <Card title="Role → Scope matrix">
          <div className="table-scroll">
            <table className="table">
              <thead>
                <tr>
                  <th>Role</th>
                  <th>Label</th>
                  <th>Scopes</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((r) => (
                  <tr key={r.role}>
                    <td>{r.role}</td>
                    <td>{r.label}</td>
                    <td>
                      {r.scopes.map((s) => (
                        <Badge key={s} tone="neutral">
                          {s}
                        </Badge>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card title="Assign admin role">
          <div className="grid2">
            <Select
              label="Admin"
              value={assignId}
              onChange={(e) => setAssignId(e.currentTarget.value)}
            >
              {admins.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.email} ({a.role})
                </option>
              ))}
            </Select>
            <Select
              label="New role"
              value={assignRole}
              onChange={(e) => setAssignRole(e.currentTarget.value as UserRole)}
            >
              {Object.values(UserRole).map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
          <Button disabled={busy || !assignId} onClick={assign}>
            Assign role
          </Button>
        </Card>
      </ApiState>
    </div>
  );
}
