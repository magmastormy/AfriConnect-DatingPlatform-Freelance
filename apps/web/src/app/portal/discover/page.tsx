'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError } from '@/lib/api';
import { DiscoverCard, NearbyProfileView, ProfileRedNoteView } from '@/lib/types';
import { isPremium, SubscriptionView, can, Capability } from '@/lib/membership';
import { ApiState, Badge, Card, Button } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { useTrackProfileView } from '@/lib/useProfileView';
import { useAuth } from '@/lib/auth';

type Mode = 'discover' | 'nearby';
type ActAction = 'like' | 'pass' | 'superlike';

// ── Normalized feed member (shared by Discover & Nearby grids) ──────────────
interface GridMember {
  userId: string;
  displayName: string;
  photo: string | null;
  age: number;
  city: string;
  headline: string | null;
  score: number | null;
  verified: boolean;
  isPremium: boolean;
  tags: string[];
}

function normalizeDiscover(card: DiscoverCard): GridMember {
  return {
    userId: card.userId,
    displayName: card.displayName ?? 'Member',
    photo: card.photos[0] ?? null,
    age: card.age,
    city: card.city,
    headline: card.headline,
    score: card.score,
    verified: card.verified,
    isPremium: card.isPremium,
    tags: card.sharedInterests ?? [],
  };
}

function normalizeNearby(card: NearbyProfileView): GridMember {
  const fallbackName = `${card.firstName} ${card.lastName}`.trim();
  return {
    userId: card.userId,
    displayName: card.displayName ?? fallbackName ?? 'Member',
    photo: card.photos[0] ?? null,
    age: card.age,
    city: card.city,
    headline: card.headline,
    score: null,
    verified: card.verified,
    isPremium: card.isPremium,
    tags: [],
  };
}

// ── Heart glyph (decorative match indicator on the feed card footer) ─────────
function HeartIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

// ── Discover / Nearby grid card (Xiaohongshu-style, browse-only) ────────────
function DiscoverGridCard({ member, onOpen }: { member: GridMember; onOpen: () => void }) {
  const initial = (member.displayName.charAt(0) || '?').toUpperCase();
  return (
    <div
      className="discover-card"
      role="button"
      tabIndex={0}
      aria-label={`View ${member.displayName}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen();
        }
      }}
    >
      <div
        className="discover-card-photo"
        style={member.photo ? { backgroundImage: `url(${member.photo})` } : undefined}
      >
        {!member.photo && <span className="photo-fallback">No photo</span>}
        <div className="discover-card-badges">
          {member.verified && <Badge tone="good">Verified</Badge>}
          {member.isPremium && <Badge tone="warn">Premium</Badge>}
        </div>
        <div className="discover-card-scrim">
          <div className="discover-card-name">
            {member.displayName} · {member.age}
          </div>
          <div className="discover-card-sub">
            {member.city}
            {member.score != null && ` · Match ${member.score}%`}
          </div>
        </div>
      </div>

      <div className="discover-card-footer">
        <span className="discover-card-avatar">
          {member.photo ? <img src={member.photo} alt="" /> : initial}
        </span>
        <span className="discover-card-id">
          <b>{member.displayName}</b>
          {member.headline && <span>{member.headline}</span>}
        </span>
        <span className="discover-card-match" aria-hidden="true">
          <HeartIcon />
          {member.score != null && <span>{member.score}%</span>}
        </span>
      </div>

      {member.tags.length > 0 && (
        <div className="discover-card-tags">
          {member.tags.map((t) => (
            <span key={t} className="discover-card-tag">
              #{t}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── RedNote drill-down (gated profile card + sticky action bar) ─────────────
function RedNoteModal({
  view,
  canConnect,
  busy,
  onAct,
  onClose,
}: {
  view: ProfileRedNoteView;
  canConnect: boolean;
  busy: boolean;
  onAct: (action: ActAction) => void;
  onClose: () => void;
}) {
  const [idx, setIdx] = useState(0);
  const photos = view.photos;
  const go = (d: number) =>
    setIdx((i) => (photos.length ? (i + d + photos.length) % photos.length : 0));

  const handleAct = (action: ActAction) => {
    void onAct(action);
    onClose();
  };

  return (
    <div className="modal-shell" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Sliding photos */}
        <div
          className="modal-photo"
          style={photos[idx] ? { backgroundImage: `url(${photos[idx]})` } : undefined}
        >
          {!photos[idx] && <span className="modal-photo-empty">No photo</span>}
          {photos.length > 1 && (
            <>
              <button
                onClick={() => go(-1)}
                className="btn btn-ghost modal-pager-btn prev"
                aria-label="Previous photo"
              >
                ‹
              </button>
              <button
                onClick={() => go(1)}
                className="btn btn-ghost modal-pager-btn next"
                aria-label="Next photo"
              >
                ›
              </button>
              <div className="modal-pager-count">
                {idx + 1} / {photos.length}
              </div>
            </>
          )}
        </div>

        <div className="modal-meta">
          <div className="modal-title-row">
            <div className="modal-name">{view.fullName}</div>
            <button className="btn btn-ghost" onClick={onClose}>
              Close
            </button>
          </div>
          <div className="modal-sub">
            {view.location.city}
            {view.location.district ? ` · ${view.location.district}` : ''}
            {view.gender ? ` · ${view.gender}` : ''}
          </div>

          {view.restricted && (
            <div className="notice">
              Some details are hidden because this member is Premium.{' '}
              <Link href="/portal/account">Upgrade</Link> to see the full profile.
            </div>
          )}

          <dl className="modal-dl">
            {view.nationality && (
              <div>
                <strong>Nationality:</strong> {view.nationality}
              </div>
            )}
            {view.profession && (
              <div>
                <strong>Profession:</strong> {view.profession}
              </div>
            )}
            {view.industry.length > 0 && (
              <div>
                <strong>Industry:</strong> {view.industry.join(', ')}
              </div>
            )}
            {view.educationLevel && (
              <div>
                <strong>Education:</strong> {view.educationLevel}
              </div>
            )}
            {view.dateOfBirth && (
              <div>
                <strong>Born:</strong> {new Date(view.dateOfBirth).toLocaleDateString()}
              </div>
            )}
          </dl>

          {view.headline && <div className="modal-headline">{view.headline}</div>}
          {view.bio && <p className="modal-bio">{view.bio}</p>}

          <div className="modal-badges">
            {view.verified && <Badge tone="good">Verified</Badge>}
            {view.isPremium && <Badge tone="warn">Premium</Badge>}
          </div>
        </div>

        {canConnect ? (
          <div className="modal-actions">
            <button className="btn btn-ghost" disabled={busy} onClick={() => handleAct('pass')}>
              Pass
            </button>
            <button
              className="btn btn-danger"
              disabled={busy}
              onClick={() => handleAct('superlike')}
            >
              ★ Superlike
            </button>
            <button className="btn btn-primary" disabled={busy} onClick={() => handleAct('like')}>
              Like
            </button>
          </div>
        ) : (
          <div className="modal-actions">
            <Link href="/get-vetted" className="btn btn-primary">
              Get vetted to connect
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

export default function DiscoverPage() {
  const toast = useToast();
  const { track } = useTrackProfileView();
  const { stage } = useAuth();
  // Unvetted members can preview members but cannot act (connect) yet.
  const canConnect = can(stage, Capability.Match);
  const [mode, setMode] = useState<Mode>('discover');

  // ── Discover deck (match scoring) ──────────────────────────────────────────
  const [deck, setDeck] = useState<DiscoverCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    if (mode === 'discover') void load();
  }, [mode, load]);

  const top = deck[0];
  useEffect(() => {
    if (mode === 'discover' && top) track(top.userId);
  }, [mode, top, track]);

  async function act(userId: string, action: ActAction) {
    if (busy) return;
    setBusy(true);
    try {
      await api.post(`/matches/${userId}/${action}`, {});
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  // ── Nearby (WeChat-Nearby, premium) ─────────────────────────────────────────
  const [nearby, setNearby] = useState<NearbyProfileView[]>([]);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [sub, setSub] = useState<SubscriptionView | null>(null);
  const [nearbyOptIn, setNearbyOptIn] = useState<boolean | null>(null);
  const [locBusy, setLocBusy] = useState(false);

  const loadNearby = useCallback(async () => {
    setNearbyLoading(true);
    setNearbyError(null);
    try {
      const s = await api.get<SubscriptionView>('/billing/subscription');
      setSub(s);
      if (!isPremium(s)) {
        setNearby([]);
        return;
      }
      const me = await api
        .get<{ nearbyEnabled: boolean }>('/profile/me')
        .catch(() => ({ nearbyEnabled: false }));
      setNearbyOptIn(me.nearbyEnabled);
      if (!me.nearbyEnabled) {
        setNearby([]);
        return;
      }
      const list = await api.getNearby();
      setNearby(list);
    } catch (e) {
      setSub(null);
      setNearby([]);
      setNearbyError(e instanceof ApiError ? e.message : 'Failed to load Nearby');
    } finally {
      setNearbyLoading(false);
    }
  }, []);

  async function shareLocation() {
    if (locBusy) return;
    setLocBusy(true);
    try {
      if (!('geolocation' in navigator)) {
        throw new Error('Location is not available on this device.');
      }
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        }),
      );
      await api.put('/profile/me/nearby', {
        nearbyEnabled: true,
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
      });
      setNearbyOptIn(true);
      await loadNearby();
    } catch (e) {
      const msg =
        e instanceof ApiError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Could not get your location.';
      setNearbyError(msg);
      toast(msg, 'error');
    } finally {
      setLocBusy(false);
    }
  }

  async function forgetLocation() {
    if (locBusy) return;
    setLocBusy(true);
    try {
      await api.put('/profile/me/nearby', { nearbyEnabled: false });
      setNearbyOptIn(false);
      setNearby([]);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Failed to forget location', 'error');
    } finally {
      setLocBusy(false);
    }
  }

  useEffect(() => {
    if (mode === 'nearby') void loadNearby();
  }, [mode, loadNearby]);

  const nearbyTop = nearby[0];
  useEffect(() => {
    if (mode === 'nearby' && nearbyTop) track(nearbyTop.userId);
  }, [mode, nearbyTop, track]);

  async function actNearby(userId: string, action: ActAction) {
    if (busy) return;
    setBusy(true);
    try {
      await api.post(`/matches/${userId}/${action}`, {});
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Action failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  // ── RedNote drill-down ───────────────────────────────────────────────────────
  const [redNote, setRedNote] = useState<ProfileRedNoteView | null>(null);
  const [redNoteLoading, setRedNoteLoading] = useState(false);
  const [redNoteError, setRedNoteError] = useState<string | null>(null);
  const [redNoteSource, setRedNoteSource] = useState<Mode | null>(null);

  const openRedNote = useCallback(
    async (userId: string) => {
      setRedNoteLoading(true);
      setRedNoteError(null);
      try {
        const view = await api.getProfile(userId);
        setRedNote(view);
      } catch (e) {
        setRedNoteError(e instanceof ApiError ? e.message : 'Failed to load profile');
        toast(e instanceof ApiError ? e.message : 'Failed to load profile', 'error');
      } finally {
        setRedNoteLoading(false);
      }
    },
    [toast],
  );

  const openRedNoteFromCard = useCallback(
    (userId: string) => {
      setRedNoteSource(mode);
      void openRedNote(userId);
    },
    [mode, openRedNote],
  );

  // Source-aware action dispatcher for the modal bar (discover vs nearby list).
  const handleRedNoteAct = useCallback(
    async (action: ActAction) => {
      if (!redNote) return;
      if (redNoteSource === 'nearby') {
        await actNearby(redNote.userId, action);
      } else {
        await act(redNote.userId, action);
      }
    },
    [redNote, redNoteSource, act, actNearby],
  );

  return (
    <div>
      <div className="page-head">
        <h1>Discover</h1>
        <p>Meet members through curated matches or find people right around you.</p>
      </div>

      <div className="tabs" style={{ marginBottom: '1.25rem' }}>
        <button data-active={mode === 'discover'} onClick={() => setMode('discover')}>
          Curated matches
        </button>
        <button data-active={mode === 'nearby'} onClick={() => setMode('nearby')}>
          Nearby
        </button>
      </div>

      {mode === 'discover' && (
        <ApiState loading={loading} error={error} empty={!loading && deck.length === 0}>
          {canConnect ? (
            <>
              <div className="discover-grid">
                {deck.map((card) => (
                  <DiscoverGridCard
                    key={card.userId}
                    member={normalizeDiscover(card)}
                    onOpen={() => openRedNoteFromCard(card.userId)}
                  />
                ))}
              </div>
              {deck.length > 0 && (
                <div className="row-actions" style={{ justifyContent: 'center', marginTop: 14 }}>
                  <button className="btn btn-subtle" disabled={loading} onClick={load}>
                    Reload
                  </button>
                </div>
              )}
            </>
          ) : (
            <>
              <div className="stage-banner">
                <p>Get vetted to like &amp; message members.</p>
                <Link href="/get-vetted" className="btn btn-primary">
                  Get vetted
                </Link>
              </div>
              <div className="discover-grid">
                {deck.slice(0, 3).map((card) => (
                  <DiscoverGridCard
                    key={card.userId}
                    member={normalizeDiscover(card)}
                    onOpen={() => openRedNoteFromCard(card.userId)}
                  />
                ))}
              </div>
            </>
          )}
        </ApiState>
      )}

      {mode === 'nearby' && (
        <ApiState
          loading={nearbyLoading}
          error={nearbyError}
          empty={!nearbyLoading && !nearbyError && nearbyOptIn === true && nearby.length === 0}
        >
          {!isPremium(sub) ? (
            <Card title="Nearby is a Premium feature">
              <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
                See vetted members in your district who have Nearby turned on — like WeChat&apos;s
                people-nearby, scoped to your neighbourhood. Upgrade to browse and be discovered.
              </p>
              <Link className="btn btn-primary" href="/portal/account">
                Upgrade to Premium
              </Link>
            </Card>
          ) : (
            <div style={{ maxWidth: 720, margin: '0 auto' }}>
              <Card title="Your location">
                {nearbyOptIn ? (
                  <>
                    <p style={{ color: 'var(--muted)', margin: '0 0 0.9rem' }}>
                      You’re sharing your location. We surface vetted members in your area.
                    </p>
                    <Button variant="ghost" disabled={locBusy} onClick={forgetLocation}>
                      {locBusy ? 'Working…' : 'Forget my location'}
                    </Button>
                  </>
                ) : (
                  <>
                    <p style={{ color: 'var(--muted)', margin: '0 0 0.9rem' }}>
                      Share your device location to discover vetted members around you. Your
                      coordinates are stored and cleared the moment you drop the feature.
                    </p>
                    <Button disabled={locBusy} onClick={shareLocation}>
                      {locBusy ? 'Locating…' : 'Share my location'}
                    </Button>
                  </>
                )}
              </Card>

              {nearbyOptIn && (
                <>
                  <div className="discover-grid">
                    {nearby.map((card) => (
                      <DiscoverGridCard
                        key={card.userId}
                        member={normalizeNearby(card)}
                        onOpen={() => openRedNoteFromCard(card.userId)}
                      />
                    ))}
                  </div>
                  {nearby.length > 0 && (
                    <div className="row-actions" style={{ justifyContent: 'center', marginTop: 14 }}>
                      <button
                        className="btn btn-subtle"
                        disabled={nearbyLoading}
                        onClick={loadNearby}
                      >
                        Reload Nearby
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </ApiState>
      )}

      {redNoteLoading && (
        <div className="state">
          <span className="spinner" />
        </div>
      )}
      {redNoteError && (
        <div className="state">
          <p className="muted">{redNoteError}</p>
        </div>
      )}
      {redNote && (
        <RedNoteModal
          view={redNote}
          canConnect={canConnect}
          busy={busy}
          onAct={handleRedNoteAct}
          onClose={() => setRedNote(null)}
        />
      )}
    </div>
  );
}
