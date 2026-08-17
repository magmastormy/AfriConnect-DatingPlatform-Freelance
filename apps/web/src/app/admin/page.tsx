'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth, isAdmin } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { Card, Button, Badge, Textarea, ApiState } from '@/components/ui';
import { AdminTabs } from '@/components/AdminTabs';
import type { ApplicationAdminView } from '@/lib/types';

const _STATUS_OPTIONS = ['submitted', 'under_review', 'approved', 'rejected', 'on_hold'] as const;
type StatusFilter = (typeof _STATUS_OPTIONS)[number] | 'all';

const PROOF_LABELS: Record<string, string> = {
  resume: 'Résumé / CV',
  work_badge: 'Work badge',
  selfie_company: 'Workplace selfie',
  linkedin: 'LinkedIn URL',
};

export default function AdminPage() {
  const { user, loading } = useAuth();
  const toast = useToast();

  const [filter, setFilter] = useState<StatusFilter>('submitted');
  const [list, setList] = useState<ApplicationAdminView[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [selected, setSelected] = useState<ApplicationAdminView | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected' | 'on_hold'>('approved');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    setLoadingList(true);
    setListError(null);
    try {
      const apps = await api.listApplications(filter === 'all' ? undefined : filter);
      setList(apps);
    } catch (e) {
      setListError(e instanceof ApiError ? e.message : 'Failed to load applications');
    } finally {
      setLoadingList(false);
    }
  }, [filter]);

  useEffect(() => {
    if (user && isAdmin(user.role)) void load();
  }, [user, load]);

  if (loading) {
    return (
      <div className="state">
        <span className="spinner" aria-label="Loading" />
      </div>
    );
  }
  if (!user || !isAdmin(user.role)) {
    return (
      <div className="card" style={{ maxWidth: 560, margin: '2rem auto' }}>
        <h1 style={{ marginTop: 0 }}>Admins only</h1>
        <p style={{ color: 'var(--muted)' }}>
          You need a vetting administrator role to view this page.
        </p>
      </div>
    );
  }

  async function submitReview() {
    if (!selected) return;
    if ((decision === 'rejected' || decision === 'on_hold') && reason.trim() === '') {
      toast('Add a reason for this decision', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await api.reviewApplication(selected.id, {
        status: decision,
        adminNotes: reason.trim() || undefined,
      });
      toast(`Application ${decision.replace('_', ' ')}`, 'success');
      setSelected(null);
      setReason('');
      await load();
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Review failed', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-head" style={{ maxWidth: 1100, margin: '0 auto' }}>
      <h1>Vetting review</h1>
      <p>Review membership applications, inspect proof, and accept or deny with a reason.</p>

      <AdminTabs />

      <div className="tabs" style={{ margin: '1rem 0' }}>
        {(['submitted', 'under_review', 'all'] as StatusFilter[]).map((s) => (
          <button key={s} data-active={filter === s} onClick={() => setFilter(s)}>
            {s === 'all' ? 'All open' : s.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="split" style={{ alignItems: 'flex-start' }}>
        {/* List */}
        <Card title={`Queue (${list.length})`}>
          <ApiState
            loading={loadingList}
            error={listError}
            empty={!loadingList && list.length === 0}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {list.map((a) => (
                <button
                  key={a.id}
                  className={`btn ${selected?.id === a.id ? 'btn-primary' : 'btn-subtle'}`}
                  style={{ justifyContent: 'space-between', textAlign: 'left' }}
                  onClick={() => setSelected(a)}
                >
                  <span>
                    {a.firstName} {a.lastName}
                    <br />
                    <span style={{ fontSize: '0.8rem', color: 'var(--muted)' }}>
                      {a.profession} · {a.city}
                    </span>
                  </span>
                  <Badge
                    tone={
                      a.status === 'approved' ? 'good' : a.status === 'rejected' ? 'bad' : 'warn'
                    }
                  >
                    {a.status.replace('_', ' ')}
                  </Badge>
                </button>
              ))}
            </div>
          </ApiState>
        </Card>

        {/* Detail + decision */}
        <Card
          title={selected ? `${selected.firstName} ${selected.lastName}` : 'Select an application'}
        >
          {!selected ? (
            <p style={{ color: 'var(--muted)' }}>
              Pick an application from the queue to review it.
            </p>
          ) : (
            <div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                <Badge tone="neutral">{selected.nationality}</Badge>
                <Badge tone="neutral">{selected.gender}</Badge>
                <Badge tone="neutral">{selected.city}</Badge>
                <Badge tone="neutral">{selected.educationLevel}</Badge>
              </div>
              <dl style={{ margin: 0, fontSize: '0.9rem', lineHeight: 1.7 }}>
                <div>
                  <strong>Profession:</strong> {selected.profession}
                </div>
                <div>
                  <strong>Employer:</strong> {selected.employer}
                </div>
                <div>
                  <strong>Institution:</strong> {selected.institution}
                </div>
                <div>
                  <strong>DOB:</strong> {new Date(selected.dateOfBirth).toLocaleDateString()}
                </div>
                <div>
                  <strong>LinkedIn:</strong>{' '}
                  {selected.linkedInUrl ? (
                    <a href={selected.linkedInUrl} target="_blank" rel="noreferrer">
                      open
                    </a>
                  ) : (
                    '—'
                  )}
                </div>
                <div>
                  <strong>Proof of work:</strong>{' '}
                  {selected.proofOfWorkType
                    ? (PROOF_LABELS[selected.proofOfWorkType] ?? selected.proofOfWorkType)
                    : '—'}
                  {selected.proofOfWorkUrl ? (
                    <>
                      {' · '}
                      <a href={selected.proofOfWorkUrl} target="_blank" rel="noreferrer">
                        view
                      </a>
                    </>
                  ) : null}
                </div>
              </dl>

              <div style={{ display: 'flex', gap: 10, margin: '12px 0' }}>
                {selected.idDocumentUrl && (
                  <a href={selected.idDocumentUrl} target="_blank" rel="noreferrer">
                    <img
                      src={selected.idDocumentUrl}
                      alt="ID document"
                      style={{
                        width: 110,
                        height: 70,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                      }}
                    />
                  </a>
                )}
                {selected.selfieUrl && (
                  <a href={selected.selfieUrl} target="_blank" rel="noreferrer">
                    <img
                      src={selected.selfieUrl}
                      alt="Selfie"
                      style={{
                        width: 110,
                        height: 70,
                        objectFit: 'cover',
                        borderRadius: 8,
                        border: '1px solid var(--line)',
                      }}
                    />
                  </a>
                )}
              </div>

              <div className="field" style={{ marginTop: 8 }}>
                <span>Decision</span>
                <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                  {(['approved', 'on_hold', 'rejected'] as const).map((d) => (
                    <button
                      key={d}
                      className={`btn ${decision === d ? 'btn-primary' : 'btn-ghost'}`}
                      onClick={() => setDecision(d)}
                    >
                      {d === 'approved' ? 'Accept' : d === 'rejected' ? 'Deny' : 'Hold'}
                    </button>
                  ))}
                </div>
              </div>

              <Textarea
                label="Reason / notes (required for deny or hold)"
                value={reason}
                onChange={(e) => setReason(e.currentTarget.value)}
                placeholder="e.g. Proof of work does not match the stated employer."
              />

              <div className="row-actions" style={{ marginTop: 12 }}>
                <Button onClick={submitReview} disabled={submitting}>
                  {submitting ? 'Submitting…' : 'Submit decision'}
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
