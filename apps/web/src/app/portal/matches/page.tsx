'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { ApiState, Button, Badge } from '@/components/ui';
import { DailyMatch, MutualMatch } from '@/lib/types';

type Tab = 'daily' | 'mutual';

export default function MatchesPage() {
  const [tab, setTab] = useState<Tab>('daily');
  const [daily, setDaily] = useState<DailyMatch[]>([]);
  const [mutual, setMutual] = useState<MutualMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
        setError(e instanceof ApiError ? e.message : 'Failed to load matches');
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

  return (
    <div>
      {superCount > 0 && (
        <div className="notice" role="status">
          You have {superCount} new {superCount === 1 ? 'superlike' : 'superlikes'}. Like them back
          on Discover to match.
        </div>
      )}
      <div className="page-head">
        <h1>Matches</h1>
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

      <ApiState
        loading={loading}
        error={error}
        empty={tab === 'daily' ? daily.length === 0 : mutual.length === 0}
      >
        {tab === 'daily' &&
          daily.map((m) => (
            <div className="match" key={m.userId}>
              <div className="avatar">
                {(m.displayName ?? m.profession ?? '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="meta">
                <div>
                  <strong>{m.displayName ?? 'Anonymous'}</strong> · {m.city} · {m.educationLevel}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
                  {m.profession ?? 'Professional'}
                </div>
                <Badge tone="good">Score {m.score}</Badge>
              </div>
              <div className="row-actions">
                <Button
                  variant="ghost"
                  disabled={busyId === m.userId}
                  onClick={() => act(m.userId, 'pass')}
                >
                  Pass
                </Button>
                <Button disabled={busyId === m.userId} onClick={() => act(m.userId, 'like')}>
                  Like
                </Button>
                <Button
                  variant="danger"
                  disabled={busyId === m.userId}
                  onClick={() => act(m.userId, 'superlike')}
                >
                  ★
                </Button>
              </div>
            </div>
          ))}

        {tab === 'mutual' &&
          mutual.map((m) => (
            <div className="match" key={m.id}>
              {m.photo ? (
                <img className="avatar" src={m.photo} alt={m.name} />
              ) : (
                <div className="avatar">★</div>
              )}
              <div className="meta">
                <div>
                  <strong>{m.name}</strong>
                  {m.profession ? (
                    <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                      {' '}
                      · {m.profession}
                    </span>
                  ) : null}
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
                  You matched — start the conversation.
                </div>
              </div>
              <Link href="/portal/messages" className="btn btn-primary">
                Message
              </Link>
            </div>
          ))}
      </ApiState>
    </div>
  );
}
