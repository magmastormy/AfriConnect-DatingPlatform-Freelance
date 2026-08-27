'use client';

import '@/app/discovery.css';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { DiscoverCard } from '@/lib/types';
import { useToast } from '@/components/Toast';
import { useTrackProfileView } from '@/lib/useProfileView';
import { useSwipeGesture } from '@/lib/use-swipe-gesture';
import { ProfileCardFull } from './ProfileCardFull';
import { ActionColumn } from './ActionColumn';
import { PhotoDots } from './PhotoDots';
import { DetailSheet } from './DetailSheet';
import { MatchCelebration } from './MatchCelebration';

type DeckAction = 'like' | 'pass' | 'superlike';

/**
 * The immersive, Instagram / Tinder-style mobile discovery surface. Renders a
 * full-screen stack of profile cards with swipe (like / pass), a Superlike
 * connection request, a tap-to-open detail sheet, undo, and a match celebration
 * that drops you into a new message thread.
 */
export function FullScreenDiscover() {
  const router = useRouter();
  const toast = useToast();
  const { track } = useTrackProfileView();

  const [deck, setDeck] = useState<DiscoverCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsVetting, setNeedsVetting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [photoIdx, setPhotoIdx] = useState(0);
  const [undo, setUndo] = useState<{ card: DiscoverCard; action: DeckAction } | null>(null);
  const [sheetCard, setSheetCard] = useState<DiscoverCard | null>(null);
  const [celebrate, setCelebrate] = useState<{ userId: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    setNeedsVetting(false);
    try {
      const cards = await api.get<DiscoverCard[]>('/matches/discover?limit=50');
      setDeck(cards);
    } catch (e) {
      const ae = e instanceof ApiError ? e : null;
      if (ae && (ae.status === 401 || ae.status === 403)) setNeedsVetting(true);
      else setError(ae?.message ?? 'Failed to load discovery');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const top = deck[0];
  useEffect(() => {
    setPhotoIdx(0);
    if (top) track(top.userId);
  }, [top, track]);

  const act = useCallback(
    async (card: DiscoverCard, action: DeckAction) => {
      if (busy) return;
      setBusy(true);
      // Remove the card immediately so the next profile appears right away;
      // restore it if the API call fails.
      setDeck((d) => d.filter((c) => c.userId !== card.userId));
      setUndo({ card, action });
      try {
        const res = await api.post<{ mutual: boolean }>(`/matches/${card.userId}/${action}`, {});
        if (res.mutual) {
          setCelebrate({ userId: card.userId });
        } else if (action === 'superlike') {
          toast('Superlike sent — they’ll see it when they discover you', 'success');
        }
      } catch (e) {
        setDeck((d) => [card, ...d]);
        setUndo(null);
        toast(e instanceof ApiError ? e.message : 'Action failed', 'error');
      } finally {
        setBusy(false);
      }
    },
    [busy, toast],
  );

  const handleMessage = useCallback(
    async (targetId: string) => {
      try {
        const { id } = await api.post<{ id: string }>('/chat/conversations', { targetId });
        router.push(`/portal/messages?c=${id}`);
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          toast('Match with this person to start chatting', 'error');
        } else {
          toast(e instanceof ApiError ? e.message : 'Could not open chat', 'error');
        }
      }
    },
    [router, toast],
  );

  const restoreUndo = useCallback(() => {
    setUndo((u) => {
      if (u) setDeck((d) => [u.card, ...d]);
      return null;
    });
  }, []);

  const swipe = useSwipeGesture({
    disabled: busy || !top,
    threshold: 50,
    onSwipeLeft: () => top && void act(top, 'pass'),
    onSwipeRight: () => top && void act(top, 'like'),
    onTap: () => top && setSheetCard(top),
  });

  if (loading && deck.length === 0) {
    return (
      <div className="fs-root fs-center">
        <span className="spinner" />
      </div>
    );
  }

  if (needsVetting) {
    return (
      <div className="fs-root fs-center">
        <div className="fs-gate">
          <h2>Get vetted to discover</h2>
          <p>Discovery and matching open once a human approves your application.</p>
          <Link href="/get-vetted" className="btn btn-primary">
            Get vetted
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fs-root fs-center">
        <div className="fs-gate">
          <p className="muted">{error}</p>
          <button className="btn btn-primary" type="button" onClick={() => void load()}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (deck.length === 0) {
    return (
      <div className="fs-root fs-center">
        <div className="fs-gate">
          <h2>No more members right now</h2>
          <p>Check back soon — new vetted members join every day.</p>
          <Link href="/portal/matches" className="btn btn-primary">
            See who liked you
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="fs-root">
      <header className="fs-header">
        <span className="fs-title">Discover</span>
        <div className="fs-header-right">
          {undo && (
            <button className="fs-undo" type="button" onClick={restoreUndo}>
              ↩ Undo
            </button>
          )}
          <Link href="/portal/matches" className="fs-likes" aria-label="Who liked you">
            ♥ Liked you
          </Link>
          <span className="fs-count">{deck.length} left</span>
        </div>
      </header>

      <div className="fs-stage">
        {deck[1] && <ProfileCardFull card={deck[1]} photoIdx={0} swipe={zeroSwipe} behind />}
        {top && <ProfileCardFull card={top} photoIdx={photoIdx} swipe={swipe} />}
        <PhotoDots count={top?.photos.length ?? 0} idx={photoIdx} onSelect={setPhotoIdx} />
      </div>

      <ActionColumn
        disabled={busy || !top}
        onPass={() => top && void act(top, 'pass')}
        onLike={() => top && void act(top, 'like')}
        onSuper={() => top && void act(top, 'superlike')}
      />

      {sheetCard && (
        <DetailSheet
          card={sheetCard}
          onClose={() => setSheetCard(null)}
          onAct={(a) => {
            void act(sheetCard, a);
            setSheetCard(null);
          }}
          onMessage={(id) => {
            setSheetCard(null);
            void handleMessage(id);
          }}
        />
      )}

      {celebrate && (
        <MatchCelebration userId={celebrate.userId} onClose={() => setCelebrate(null)} />
      )}
    </div>
  );
}

// A no-op swipe object for the dimmed "behind" card (it should not be draggable).
const zeroSwipe = {
  dx: 0,
  dy: 0,
  dragging: false,
  handlers: {
    onPointerDown: () => {},
    onPointerMove: () => {},
    onPointerUp: () => {},
    onPointerCancel: () => {},
  },
};
