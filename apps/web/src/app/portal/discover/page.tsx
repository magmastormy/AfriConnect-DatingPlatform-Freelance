'use client';

import { useCallback, useEffect, useState, memo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { api, ApiError } from '@/lib/api';
import { DiscoverCard, NearbyProfileView, ProfileRedNoteView, City, DiscoverFilters } from '@/lib/types';
import { isPremium, SubscriptionView, can, Capability } from '@/lib/membership';
import { ApiState, Badge, Card, Button } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { AwarenessBanner } from '@/components/AwarenessBanner';
import { useTrackProfileView } from '@/lib/useProfileView';
import { useAuth } from '@/lib/auth';
import { useViewport } from '@/lib/use-viewport';
import { labelCity, labelEducation } from '@/lib/labels';
import { FullScreenDiscover } from '@/components/discover/FullScreenDiscover';
import { MatchCelebration } from '@/components/discover/MatchCelebration';

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
  distanceKm: number | null;
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
    distanceKm: (card as { distanceKm?: number | null }).distanceKm ?? null,
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
    distanceKm: card.distanceKm ?? null,
  };
}

// ── Heart glyph (decorative match indicator on the feed card footer) ─────────
function formatDistance(distanceKm: number | null): string | null {
  if (distanceKm == null) return null;
  if (distanceKm < 1) return 'Under 1 km away';
  if (distanceKm < 10) return `${distanceKm.toFixed(1)} km away`;
  return `${Math.round(distanceKm)} km away`;
}

const CITY_OPTIONS = ['johannesburg', 'cape_town', 'durban', 'pretoria', 'pietermaritzburg'] as const;

// Presentational filter bar. All fields optional — clearing everything returns
// to the default engine-ranked deck. `onChange` lifts the draft to the page so
// the deck reloads only when the user applies.
const DiscoverFiltersBar = memo(function DiscoverFiltersBar({
  value,
  onChange,
  onApply,
  onReset,
}: {
  value: DiscoverFilters;
  onChange: (next: DiscoverFilters) => void;
  onApply: () => void;
  onReset: () => void;
}) {
  const hasFilters = Boolean(value.city || value.ageMin || value.ageMax || value.interests);
  return (
    <div className="discover-filters" aria-label="Discover filters">
      <label className="field field-inline">
        <span>City</span>
        <select
          value={value.city ?? ''}
          onChange={(e) => onChange({ ...value, city: (e.target.value || undefined) as City | undefined })}
        >
          <option value="">Any</option>
          {CITY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
            </option>
          ))}
        </select>
      </label>
      <label className="field field-inline">
        <span>Min age</span>
        <input
          type="number"
          min={18}
          max={99}
          placeholder="18"
          value={value.ageMin ?? ''}
          onChange={(e) => onChange({ ...value, ageMin: (e.target.value || undefined) as number | undefined })}
        />
      </label>
      <label className="field field-inline">
        <span>Max age</span>
        <input
          type="number"
          min={18}
          max={99}
          placeholder="99"
          value={value.ageMax ?? ''}
          onChange={(e) => onChange({ ...value, ageMax: (e.target.value || undefined) as number | undefined })}
        />
      </label>
      <label className="field field-inline field-grow">
        <span>Interests (comma-separated)</span>
        <input
          type="text"
          placeholder="travel, music"
          value={value.interests ?? ''}
          onChange={(e) => onChange({ ...value, interests: e.target.value })}
        />
      </label>
      <div className="row-actions" style={{ marginLeft: 'auto', gap: 8 }}>
        <button className="btn btn-subtle" type="button" onClick={onApply}>
          Apply
        </button>
        {hasFilters && (
          <button className="btn btn-ghost" type="button" onClick={onReset}>
            Reset
          </button>
        )}
      </div>
    </div>
  );
});

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

// ── Discover / Nearby grid card (lean, memoized, single-image) ────────────
// Rendered potentially hundreds of times, so it is:
//  • memo()'d — parent re-renders (e.g. switching tabs) don't re-render every card
//  • stateless — no per-card effects or handlers; the click handler is passed in
//  • one <Image> — the footer reuses the same photo via CSS background, no 2nd fetch
//  • formatDistance() computed once, not twice
const DiscoverGridCard = memo(function DiscoverGridCard({
  member,
  onOpen,
  priority = false,
}: {
  member: GridMember;
  onOpen: (userId: string) => void;
  priority?: boolean;
}) {
  const distance = formatDistance(member.distanceKm);
  return (
    <div
      className="discover-card"
      role="button"
      tabIndex={0}
      aria-label={`View ${member.displayName}`}
      onClick={() => onOpen(member.userId)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onOpen(member.userId);
        }
      }}
    >
      <div
        className="discover-card-photo"
        style={{ position: 'relative', overflow: 'hidden', backgroundColor: 'var(--surface-3)' }}
      >
        {member.photo ? (
          <Image
            src={member.photo}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 33vw"
            style={{ objectFit: 'cover' }}
            priority={priority}
            loading={priority ? undefined : 'lazy'}
            decoding="async"
            fetchPriority={priority ? 'high' : 'low'}
          />
        ) : (
          <span className="photo-fallback">No photo</span>
        )}
        <div className="discover-card-badges">
          {member.verified && <Badge tone="good">Verified</Badge>}
          {member.isPremium && <Badge tone="warn">Premium</Badge>}
        </div>
        <div className="discover-card-scrim">
          <div className="discover-card-name">
            {member.displayName} · {member.age}
          </div>
          <div className="discover-card-sub">
            {labelCity(member.city)}
            {member.score != null && ` · Match ${member.score}%`}
          </div>
          {distance && <div className="discover-card-distance">{distance}</div>}
        </div>
      </div>

      <div className="discover-card-footer">
        <span className="discover-card-id">
          <b>{member.displayName}</b>
          {member.headline && <span>{member.headline}</span>}
        </span>
        {member.score != null && (
          <span className="discover-card-match" aria-hidden="true">
            <HeartIcon />
            <span>{member.score}%</span>
          </span>
        )}
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
});

// ── Skeleton for fast perceived load ───────────────────────────────────────
function DiscoverSkeletonGrid() {
  return (
    <div className="discover-grid" aria-busy="true" aria-label="Loading members">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="discover-card"
          style={{
            height: 320,
            background: 'var(--surface-2)',
            border: '1px solid var(--line)',
            animation: 'pulse 1.4s ease-in-out infinite',
            opacity: 0.7,
          }}
        >
          <div style={{ height: '72%', background: 'var(--line)', opacity: 0.5 }} />
          <div style={{ padding: '12px', display: 'grid', gap: 8 }}>
            <div style={{ height: 12, width: '60%', background: 'var(--line)', borderRadius: 6 }} />
            <div style={{ height: 10, width: '40%', background: 'var(--line)', borderRadius: 6 }} />
          </div>
        </div>
      ))}
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
        {/* Sliding photos — next/image with priority for LCP (first 2) */}
        <div className="modal-photo" style={{ position: 'relative', overflow: 'hidden' }}>
          {photos[idx] ? (
            <Image
              src={photos[idx]}
              alt=""
              fill
              sizes="(max-width: 768px) 100vw, 600px"
              style={{ objectFit: 'cover' }}
              priority={idx < 2}
            />
          ) : (
            <span className="modal-photo-empty">No photo</span>
          )}
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
            {labelCity(view.location.city)}
            {view.location.district ? ` · ${view.location.district}` : ''}
            {view.gender ? ` · ${view.gender.charAt(0).toUpperCase()}${view.gender.slice(1)}` : ''}
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
                <strong>Education:</strong> {labelEducation(view.educationLevel)}
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
  const isMobile = useViewport(860);
  const [mode, setMode] = useState<Mode>('discover');
  // When a Like/Superlike completes a mutual match on desktop, celebrate and
  // offer to open the (lazily created) conversation — mirrors the mobile flow.
  const [celebrate, setCelebrate] = useState<string | null>(null);

  // ── Discover deck (match scoring) ──────────────────────────────────────────
  const [deck, setDeck] = useState<DiscoverCard[]>([]);
  const [filters, setFilters] = useState<DiscoverFilters>({});
  const [draft, setDraft] = useState<DiscoverFilters>({});
  const [superCount, setSuperCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cards = await api.getDiscover({
        city: filters.city || undefined,
        ageMin: filters.ageMin ? Number(filters.ageMin) : undefined,
        ageMax: filters.ageMax ? Number(filters.ageMax) : undefined,
        interests: filters.interests?.trim() || undefined,
        limit: 20,
      });
      setDeck(cards);
      try {
        const s = await api.get<{ count: number }>('/matches/superlikes-received');
        setSuperCount(s.count);
      } catch {
        // Superlike count is a nice-to-have; never block the deck on it.
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load discovery');
    } finally {
      setLoading(false);
    }
  }, [filters]);

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
      const res = await api.post<{ mutual: boolean }>(`/matches/${userId}/${action}`, {});
      // A completed mutual match unlocks chat — surface the celebration that
      // lazily opens the conversation (same moment mobile users get).
      if (res.mutual) setCelebrate(userId);
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
      const [s, me] = await Promise.all([
        api.get<SubscriptionView>('/billing/subscription').catch(() => null),
        api.get<{ nearbyEnabled: boolean }>('/profile/me').catch(() => ({ nearbyEnabled: false })),
      ]);
      setSub(s);
      setNearbyOptIn(me.nearbyEnabled);
      // Nearby is ungated: any vetted member can see the people around them. The
      // server returns the full list for Premium and a 2-person teaser for
      // free+vetted, so we just render whatever comes back.
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
          maximumAge: 0,
        }),
      );
      const { latitude, longitude } = pos.coords;
      await api.put('/profile/me/nearby', {
        nearbyEnabled: true,
        latitude,
        longitude,
      });
      setNearbyOptIn(true);
      await loadNearby();
    } catch (e) {
      // Translate the browser/permission failures into an honest, actionable
      // message instead of the generic "Could not get your location".
      const msg = geolocationMessage(e);
      setNearbyError(msg);
      toast(msg, 'error');
    } finally {
      setLocBusy(false);
    }
  }

  /** Maps a GeolocationPositionError (or generic throw) to a clear message. */
  function geolocationMessage(e: unknown): string {
    if (e instanceof ApiError) return e.message;
    if (e instanceof Error) {
      // GeolocationPositionError carries a numeric `code` (1=denied, 2=unavailable, 3=timeout).
      const code = (e as { code?: number }).code;
      if (code === 1) return 'Location permission was denied. Enable it in your browser settings, then try again.';
      if (code === 3) return 'Your device took too long to find your location. Check your signal and try again.';
      if (code === 2) return 'Location is unavailable right now. We’ll still show members in your city.';
      return e.message || 'Could not get your location.';
    }
    return 'Could not get your location.';
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
      const res = await api.post<{ mutual: boolean }>(`/matches/${userId}/${action}`, {});
      if (res.mutual) setCelebrate(userId);
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
  // Unvetted members can preview cards but cannot open a profile — clicking a
  // card surfaces this verification-needed gate instead of the detail sheet.
  const [unvettedGate, setUnvettedGate] = useState<string | null>(null);

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
      if (!canConnect) {
        // Preview-only: don't load the protected profile, just surface the gate.
        setUnvettedGate(userId);
        return;
      }
      setRedNoteSource(mode);
      void openRedNote(userId);
    },
    [mode, openRedNote, canConnect],
  );

  // Stable card-open handler — memo keeps card onClick identities constant
  // across parent re-renders so React.memo'ed DiscoverGridCards don't re-render.
  const handleCardOpen = useCallback(
    (userId: string) => openRedNoteFromCard(userId),
    [openRedNoteFromCard],
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

  // On phones, swap the browse grid for the immersive full-screen swipe deck.
  if (isMobile) return <FullScreenDiscover />;

  return (
    <div>
      <div className="page-head">
        <h1>Discover</h1>
        <p>Meet members through curated matches or find people right around you.</p>
      </div>

      {superCount > 0 && (
        <AwarenessBanner
          tone="superlike"
          icon="★"
          title={`${superCount} new ${superCount === 1 ? 'superlike' : 'superlikes'}`}
          cta={{ label: 'Like them back', href: '/portal/matches?tab=daily' }}
        >
          Someone thinks you stand out — open Matches to superlike them back and match.
        </AwarenessBanner>
      )}

      <div className="tabs" style={{ marginBottom: '1.25rem' }}>
        <button data-active={mode === 'discover'} onClick={() => setMode('discover')}>
          Curated matches
        </button>
        <button data-active={mode === 'nearby'} onClick={() => setMode('nearby')}>
          Nearby
        </button>
      </div>

      {mode === 'discover' && (
        <DiscoverFiltersBar
          value={draft}
          onChange={setDraft}
          onApply={() => setFilters(draft)}
          onReset={() => {
            setDraft({});
            setFilters({});
          }}
        />
      )}

      {mode === 'discover' && (
        <>
          {loading && deck.length === 0 ? (
            <DiscoverSkeletonGrid />
          ) : (
            <ApiState loading={false} error={error} empty={deck.length === 0}>
              {canConnect ? (
                <>
                  <div className="discover-grid">
                    {deck.map((card, idx) => (
                      <DiscoverGridCard
                        key={card.userId}
                        member={normalizeDiscover(card)}
                        onOpen={handleCardOpen}
                        priority={idx < 2}
                      />
                    ))}
                  </div>
                  {deck.length > 0 && (
                    <div
                      className="row-actions"
                      style={{ justifyContent: 'center', marginTop: 14 }}
                    >
                      <button className="btn btn-subtle" disabled={loading} onClick={load}>
                        Reload
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="stage-banner">
                    <p>You're previewing members. Get vetted to like, match and message.</p>
                    <Link href="/get-vetted" className="btn btn-primary">
                      Get vetted
                    </Link>
                  </div>
                  <div className="discover-grid">
                    {deck.map((card, idx) => (
                      <DiscoverGridCard
                        key={card.userId}
                        member={normalizeDiscover(card)}
                        onOpen={handleCardOpen}
                        priority={idx < 2}
                      />
                    ))}
                  </div>
                </>
              )}
            </ApiState>
          )}
        </>
      )}

      {mode === 'nearby' && (
        <>
          {nearbyLoading && nearby.length === 0 && nearbyOptIn !== false ? (
            <DiscoverSkeletonGrid />
          ) : (
            <ApiState
              loading={false}
              error={nearbyError}
              empty={!nearbyError && nearbyOptIn === true && nearby.length === 0}
            >
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
                      {nearby.map((card, idx) => (
                        <DiscoverGridCard
                          key={card.userId}
                          member={normalizeNearby(card)}
                          onOpen={handleCardOpen}
                          priority={idx < 2}
                        />
                      ))}
                    </div>
                    {nearby.length > 0 && (
                      <div
                        className="row-actions"
                        style={{ justifyContent: 'center', marginTop: 14 }}
                      >
                        <button
                          className="btn btn-subtle"
                          disabled={nearbyLoading}
                          onClick={loadNearby}
                        >
                          Reload Nearby
                        </button>
                      </div>
                    )}
                    {/* Free+vetted members hit the server-side 2-person cap — point
                        them to Premium for the full district list. */}
                    {!isPremium(sub) && nearby.length > 0 && (
                      <p className="notice" style={{ marginTop: 12 }}>
                        Showing {nearby.length} nearby {nearby.length === 1 ? 'member' : 'members'}.
                        Upgrade to Premium to see everyone around you.
                        {' '}
                        <Link href="/portal/account">Upgrade →</Link>
                      </p>
                    )}
                  </>
                )}
              </div>
            </ApiState>
          )}
        </>
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

      {celebrate && (
        <MatchCelebration userId={celebrate} onClose={() => setCelebrate(null)} />
      )}

      {unvettedGate && (
        <div className="modal-backdrop" onClick={() => setUnvettedGate(null)}>
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Verification required</h3>
            <p className="muted">
              You're previewing members while your profile is still being verified. Get
              vetted to open profiles, like, match and message.
            </p>
            <div className="row-actions" style={{ justifyContent: 'flex-end' }}>
              <button className="btn btn-subtle" onClick={() => setUnvettedGate(null)}>
                Close
              </button>
              <Link href="/get-vetted" className="btn btn-primary" onClick={() => setUnvettedGate(null)}>
                Get vetted
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
