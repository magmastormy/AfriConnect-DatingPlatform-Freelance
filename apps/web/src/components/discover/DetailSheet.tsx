'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { DiscoverCard, ProfileRedNoteView } from '@/lib/types';
import { Badge, Button } from '@/components/ui';
import type { ActAction } from './ActionColumn';

/**
 * Bottom sheet that opens on tap. Fetches the full (tier-aware) profile for the
 * bio + interests, and exposes connect actions plus a direct Message CTA. The
 * Message button opens a conversation lazily — the backend guards it on a mutual
 * match and rejects otherwise, which the parent surfaces as a toast.
 */
export function DetailSheet({
  card,
  onClose,
  onAct,
  onMessage,
}: {
  card: DiscoverCard;
  onClose: () => void;
  onAct: (a: ActAction) => void;
  onMessage: (targetId: string) => void;
}) {
  const [view, setView] = useState<ProfileRedNoteView | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api
      .getProfile(card.userId)
      .then((v) => {
        if (!cancelled) setView(v);
      })
      .catch(() => {
        /* profile fetch is best-effort; the deck card already has summary data */
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [card.userId]);

  const photo = card.photos[0];

  return (
    <div className="fs-sheet-shell" onClick={onClose} role="dialog" aria-modal="true">
      <div className="fs-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="fs-sheet-handle" />
        <div
          className="fs-sheet-photo"
          style={photo ? { backgroundImage: `url(${photo})` } : undefined}
        >
          {!photo && <span className="photo-fallback">No photo</span>}
        </div>

        <div className="fs-sheet-head">
          <div className="fs-sheet-name">
            {card.displayName ?? 'Member'} · {card.age}
          </div>
          <div className="fs-sheet-sub">
            {card.city}
            {card.profession ? ` · ${card.profession}` : ''}
          </div>
          <div className="fs-sheet-badges">
            {card.verified && <Badge tone="good">Verified</Badge>}
            {card.isPremium && <Badge tone="warn">Premium</Badge>}
          </div>
        </div>

        {loading && <div className="fs-sheet-loading">Loading profile…</div>}

        {view && (
          <div className="fs-sheet-body">
            {view.headline && <div className="fs-sheet-headline">{view.headline}</div>}
            {view.bio && <p className="fs-sheet-bio">{view.bio}</p>}
            {card.sharedInterests?.length > 0 && (
              <div className="fs-sheet-tags">
                {card.sharedInterests.map((t) => (
                  <span key={t} className="fs-tag">
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="fs-sheet-actions">
          <Button variant="ghost" disabled={loading} onClick={() => onAct('pass')}>
            Pass
          </Button>
          <Button variant="danger" disabled={loading} onClick={() => onAct('superlike')}>
            ★ Superlike
          </Button>
          <Button variant="primary" disabled={loading} onClick={() => onAct('like')}>
            Like
          </Button>
        </div>

        <button className="fs-sheet-message" type="button" onClick={() => onMessage(card.userId)}>
          Message
        </button>
      </div>
    </div>
  );
}
