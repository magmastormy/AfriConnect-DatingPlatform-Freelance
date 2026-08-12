'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { ApiState, Button, Badge } from '@/components/ui';
import { DailyMatch } from '@/lib/types';

type Tab = 'daily' | 'mutual';

export default function MatchesPage() {
  const [tab, setTab] = useState<Tab>('daily');
  const [daily, setDaily] = useState<DailyMatch[]>([]);
  const [mutual, setMutual] = useState<{ id: string; matchedUserId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const d = await api.get<{ matches: DailyMatch[] }>('/matches/daily');
        setDaily(d.matches);
        const m = await api.get<{ id: string; matchedUserId: string }[]>('/matches/mutual');
        setMutual(m);
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
              <div className="avatar">★</div>
              <div className="meta">
                <div>
                  <strong>It&apos;s a match!</strong>
                </div>
                <div style={{ color: 'var(--muted)', fontSize: '0.88rem' }}>
                  You can now message each other.
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
