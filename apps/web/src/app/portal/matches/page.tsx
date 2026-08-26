'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { ApiState, Button, Badge } from '@/components/ui';
import { AwarenessBanner } from '@/components/AwarenessBanner';
import { DailyMatch, MutualMatch } from '@/lib/types';
import { useAuth } from '@/lib/auth';
import { can, Capability } from '@/lib/membership';

type Tab = 'daily' | 'mutual';

function formatDistance(distanceKm: number | null): string | null {
  if (distanceKm == null) return null;
  if (distanceKm < 1) return 'Under 1 km';
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km`;
  return `${Math.round(distanceKm)} km`;
}

export default function MatchesPage() {
  const { stage } = useAuth();
  const canConnect = can(stage, Capability.Match);
  const [tab, setTab] = useState<Tab>('daily');
  const [daily, setDaily] = useState<DailyMatch[]>([]);
  const [mutual, setMutual] = useState<MutualMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [superCount, setSuperCount] = useState(0);

  useEffect(() => {
    void (async () => {
      try {
        const d = await api.get<DailyMatch[]>('/matches/daily');
        setDaily(d);
        const m = await api.get<MutualMatch[]>('/matches/mutual');
        setMutual(m);
        const s = await api.get<{ count: number }>('/matches/superlikes-received');
        setSuperCount(s.count);
      } catch (e) {
        // A 403 (unvetted) is expected for members who haven't cleared vetting
        // yet — render the gate instead of a red error state.
        if (e instanceof ApiError && e.status === 403) {
          setBlocked(true);
        } else {
          setError(e instanceof ApiError ? e.message : 'Failed to load matches');
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function act(userId: string, action: 'like' | 'pass' | 'superlike') {
    setBusyId(userId);
    try {
      await api.post(`/matches/${userId}/${action}`);
      setDaily((prev) => prev.filter((m) => m.userId !== userId));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setBusyId(null);
    }
  }

  // ── Daily match row — polished card (photo + meta + pill actions) ──────
  function DailyRow({ m }: { m: DailyMatch }) {
    const initial = (m.displayName ?? m.profession ?? '?').slice(0, 1).toUpperCase();
    const distance = formatDistance(m.distanceKm);
    return (
      <div className="match" key={m.userId} style={{ alignItems: 'center', padding: '12px 12px', borderRadius: 14 }}>
        <div className="avatar" style={{ width: 56, height: 56, fontSize: '1.1rem', flex: 'none' }}>
          {m.photo ? (
            <img className="avatar-img" src={m.photo} alt={m.displayName ?? 'Member'} style={{ width: '100%', height: '100%', borderRadius: '50%' }} />
          ) : (
            initial
          )}
        </div>
        <div className="meta" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <strong style={{ fontSize: '1rem' }}>{m.displayName ?? 'Anonymous'}</strong>
            <Badge tone="good">Match {m.score}%</Badge>
            {distance && <span style={{ fontSize: '.74rem', color: 'var(--muted)', background: 'var(--surface-2)', border: '1px solid var(--line)', padding: '2px 7px', borderRadius: 999 }}>{distance}</span>}
          </div>
          <div style={{ color: 'var(--muted)', fontSize: '0.86rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {m.profession ?? 'Professional'}{m.city ? ` · ${m.city}` : ''}
          </div>
        </div>
        <div className="row-actions" style={{ gap: 6, flexWrap: 'nowrap' }}>
          <button className="btn btn-ghost" disabled={busyId === m.userId} onClick={() => act(m.userId, 'pass')} style={{ borderRadius: 999, minHeight: 38, padding: '0 14px' }}>Pass</button>
          <button className="btn btn-primary" disabled={busyId === m.userId} onClick={() => act(m.userId, 'like')} style={{ borderRadius: 999, minHeight: 38, padding: '0 16px', fontWeight: 800 }}>♡ Like</button>
          <button className="btn btn-danger" disabled={busyId === m.userId} onClick={() => act(m.userId, 'superlike')} title="Superlike" style={{ borderRadius: 999, minWidth: 42, minHeight: 38 }}>★</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {superCount > 0 && (
        <AwarenessBanner
          tone="superlike"
          icon="★"
          title={`${superCount} new ${superCount === 1 ? 'superlike' : 'superlikes'}`}
          cta={{ label: 'Like them back', href: '/portal/discover' }}
        >
          Someone thinks you stand out — superlike them on Discover to match instantly.
        </AwarenessBanner>
      )}
      {mutual.length > 0 && (
        <AwarenessBanner
          tone="match"
          icon="✓"
          title={`${mutual.length} mutual ${mutual.length === 1 ? 'match' : 'matches'}`}
          cta={{ label: 'Say hello', href: '/portal/messages' }}
        >
          You both like each other. Start the conversation before the moment passes.
        </AwarenessBanner>
      )}
      <div className="page-head">
        <h1>Matches</h1>
        <p>Today&apos;s curated introductions, plus the members you&apos;ve already matched with.</p>
        <div className="row-actions">
          <Button variant={tab === 'daily' ? 'primary' : 'subtle'} onClick={() => setTab('daily')}>
            Daily
          </Button>
          <Button
            variant={tab === 'mutual' ? 'primary' : 'subtle'}
            onClick={() => setTab('mutual')}
          >
            Mutual ({mutual.length})
          </Button>
        </div>
      </div>

      {!canConnect || blocked ? (
        <div className="stage-banner">
          <p>Get vetted to see your matches.</p>
          <Link href="/get-vetted" className="btn btn-primary">
            Get vetted
          </Link>
        </div>
      ) : (
        <ApiState
          loading={loading}
          error={error}
          empty={tab === 'daily' ? daily.length === 0 : mutual.length === 0}
        >
          {tab === 'daily' &&
            (daily.length === 0 ? (
              <div className="empty-state">
                <p>No new introductions right now. New matches arrive every day — check back soon.</p>
                <Link className="btn btn-primary" href="/portal/discover">
                  Browse Discover
                </Link>
              </div>
            ) : (
              daily.map((m) => <DailyRow key={m.userId} m={m} />)
            ))}

          {tab === 'mutual' &&
            (mutual.length === 0 ? (
              <div className="empty-state">
                <p>
                  No mutual matches yet. Like the people you connect with on Discover and a match
                  opens here the moment they like you back.
                </p>
                <Link className="btn btn-primary" href="/portal/discover">
                  Find people on Discover
                </Link>
              </div>
            ) : (
              mutual.map((m) => (
                <div className="match" key={m.id} style={{ alignItems: 'center', padding: '12px 14px', borderRadius: 14 }}>
                  {m.photo ? (
                    <img src={m.photo} alt={m.name} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', flex: 'none' }} />
                  ) : (
                    <div className="avatar" style={{ width: 56, height: 56 }}>★</div>
                  )}
                  <div className="meta" style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <strong>{m.name}</strong>
                      {m.city && <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}>· {m.city}</span>}
                      <span className="badge badge-good" style={{ marginLeft: 4 }}>Mutual</span>
                    </div>
                    <div style={{ color: 'var(--muted)', fontSize: '0.86rem' }}>
                      {m.profession ?? 'You matched — start the conversation.'}
                    </div>
                  </div>
                  <Link href="/portal/messages" className="btn btn-primary" style={{ borderRadius: 999, padding: '0 16px', minHeight: 38 }}>
                    Message
                  </Link>
                </div>
              ))
            ))}
        </ApiState>
      )}
    </div>
  );
}
