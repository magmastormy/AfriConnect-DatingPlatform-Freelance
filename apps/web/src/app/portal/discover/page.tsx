'use client';

import { useCallback, useEffect, useState, memo } from 'react';
import { api, ApiError } from '@/lib/api';
import { DiscoverCard } from '@/lib/types';
import { ApiState, Badge } from '@/components/ui';
import { useToast } from '@/components/Toast';

interface DragState {
  x: number;
  y: number;
}

// Memoized so dragging one card doesn't re-render the whole deck container.
const DiscoveryCardView = memo(function DiscoveryCardView({
  card,
  drag,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  card: DiscoverCard;
  drag: DragState | null;
  onPointerDown: (e: React.PointerEvent) => void;
  onPointerMove: (e: React.PointerEvent) => void;
  onPointerUp: () => void;
}) {
  return (
    <div
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      style={{
        transform: drag ? `translate(${drag.x}px, ${drag.y}px) rotate(${drag.x / 18}deg)` : 'none',
        transition: drag ? 'none' : 'transform 0.25s ease',
        background: 'var(--surface)',
        border: '1px solid var(--line)',
        borderRadius: 20,
        boxShadow: 'var(--shadow)',
        overflow: 'hidden',
        cursor: 'grab',
        touchAction: 'none',
      }}
    >
      <div
        style={{
          height: 360,
          background: card.photos.length
            ? `center/cover url(${card.photos[0]})`
            : 'linear-gradient(135deg, #ffedd5, #fde68a)',
          display: 'flex',
          alignItems: 'flex-end',
          padding: '1rem',
          color: '#fff',
        }}
      >
        <div>
          <div
            style={{ fontSize: '1.4rem', fontWeight: 800, textShadow: '0 1px 4px rgba(0,0,0,.4)' }}
          >
            {card.displayName ?? 'Member'} · {card.age}
          </div>
          <div style={{ fontSize: '0.9rem', textShadow: '0 1px 4px rgba(0,0,0,.4)' }}>
            {card.city} · {card.educationLevel ?? '—'}
          </div>
        </div>
      </div>
      <div style={{ padding: '1rem' }}>
        {card.headline && <div style={{ fontWeight: 600, marginBottom: 6 }}>{card.headline}</div>}
        <div style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: 8 }}>
          {card.profession ?? 'Professional'}
          {card.employer ? ` · ${card.employer}` : ''}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <Badge tone="good">Match {card.score}%</Badge>
          {card.verified && <Badge tone="good">Verified</Badge>}
          {card.isPremium && <Badge tone="warn">Premium</Badge>}
        </div>
        {card.sharedInterests.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {card.sharedInterests.map((i) => (
              <span key={i} className="badge badge-neutral">
                {i}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

export default function DiscoverPage() {
  const toast = useToast();
  const [deck, setDeck] = useState<DiscoverCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState<{ x: number; y: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cards = await api.get<DiscoverCard[]>('/matches/discover?limit=20');
      setDeck(cards);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load discovery');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const top = deck[0];

  async function act(action: 'like' | 'pass' | 'superlike') {
    if (!top || busy) return;
    setBusy(true);
    try {
      await api.post(`/matches/${top.userId}/${action}`, {});
      setDeck((d) => d.slice(1));
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  function onPointerDown(e: React.PointerEvent) {
    if (!top) return;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    setDrag({ x: e.clientX, y: e.clientY });
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag || !top) return;
    setDrag({ x: e.clientX - drag.x, y: e.clientY });
  }
  function onPointerUp() {
    if (!drag || !top) return;
    const dx = drag.x;
    setDrag(null);
    if (dx > 110) act('like');
    else if (dx < -110) act('pass');
  }

  return (
    <div>
      <div className="page-head">
        <h1>Discover</h1>
        <p>Swipe right to like, left to pass. Compatibility is scored from your preferences.</p>
      </div>

      <ApiState loading={loading} error={error} empty={!loading && deck.length === 0}>
        <div style={{ maxWidth: 420, margin: '0 auto' }}>
          {top && (
            <DiscoveryCardView
              card={top}
              drag={drag}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
            />
          )}

          <div className="row-actions" style={{ justifyContent: 'center', marginTop: 18 }}>
            <button className="btn btn-ghost" disabled={busy} onClick={() => act('pass')}>
              Pass
            </button>
            <button className="btn btn-danger" disabled={busy} onClick={() => act('superlike')}>
              ★
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => act('like')}>
              Like
            </button>
          </div>
          {deck.length <= 1 && !loading && (
            <div className="state" style={{ marginTop: 12 }}>
              <button className="btn btn-subtle" onClick={load}>
                Reload deck
              </button>
            </div>
          )}
        </div>
      </ApiState>
    </div>
  );
}
