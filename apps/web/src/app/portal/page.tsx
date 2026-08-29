'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { SubscriptionStatus } from '@/lib/shared';
import { useAuth } from '@/lib/auth';
import { can, Capability, MembershipStage } from '@/lib/membership';
import { DiscoverCard, ProfileRedNoteView } from '@/lib/types';
import { labelCity, labelEducation } from '@/lib/labels';
import { Badge } from '@/components/ui';

interface Profile {
  firstName?: string;
  lastName?: string;
  city?: string;
  profession?: string | null;
  isComplete?: boolean;
  isPaused?: boolean;
}
interface Sub {
  plan: string;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
}

const CITIES: Record<string, string> = {
  johannesburg: 'Johannesburg',
  cape_town: 'Cape Town',
  durban: 'Durban',
  pretoria: 'Pretoria',
  pietermaritzburg: 'Pietermaritzburg',
};

function ageFromDob(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age > 0 ? age : null;
}

export default function PortalDashboard() {
  const { stage } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [dailyCount, setDailyCount] = useState<number | null>(null);
  const [preview, setPreview] = useState<DiscoverCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [profileView, setProfileView] = useState<ProfileRedNoteView | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Even unvetted members can preview a few seeded members; only the act of
  // connecting (like / pass) is gated behind vetting.
  const canConnect = can(stage, Capability.Match);

  useEffect(() => {
    void (async () => {
      try {
        const [p, s, d, members] = await Promise.all([
          api.get<Profile>('/profile/me'),
          api.get<Sub | null>('/billing/subscription').catch(() => null),
          api
            .get<{ matches: unknown[] }>('/matches/daily')
            .then((r) => r.matches.length)
            .catch(() => 0),
          api.get<DiscoverCard[]>('/matches/preview?limit=3').catch(() => []),
        ]);
        setProfile(p);
        setSub(s);
        setDailyCount(d);
        setPreview(members.slice(0, 3));
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function openProfile(userId: string) {
    setProfileId(userId);
    setProfileLoading(true);
    try {
      const view = await api.getProfile(userId);
      setProfileView(view);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Failed to load profile');
      setProfileId(null);
    } finally {
      setProfileLoading(false);
    }
  }

  function closeProfile() {
    setProfileId(null);
    setProfileView(null);
  }

  const planLabel = sub ? sub.plan : 'Free';
  const active = sub?.status === SubscriptionStatus.Active;
  const city = profile?.city ? (CITIES[profile.city] ?? profile.city) : '—';
  const name = profile?.firstName ? `${profile.firstName}` : 'Member';

  const steps: { label: string; done: boolean; href: string }[] = [
    {
      label: 'Complete your profile',
      done: !!(profile?.firstName && profile?.isComplete),
      href: '/portal/account',
    },
    {
      label: 'Verify your identity',
      done: stage === MembershipStage.Verified,
      href: '/get-vetted',
    },
    { label: 'Review today’s introductions', done: (dailyCount ?? 0) > 0, href: '/portal/matches' },
    {
      label: 'Resume your profile to be matched',
      done: profile?.isPaused === false,
      href: '/portal/account',
    },
  ];

  return (
    <>
      <div
        className="lede"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        <div>
          <p className="kicker">Member home</p>
          <h1 className="display" style={{ margin: '0 0 8px' }}>
            Good to see you, {name}.
          </h1>
          <p className="standfirst">
            {dailyCount ?? '—'} new introduction{dailyCount === 1 ? '' : 's'} waiting in {city}.
          </p>
        </div>
        <div className="meta-table" style={{ minWidth: 220 }}>
          <div className="meta-row">
            <span className="meta-k">Membership</span>
            <span className="meta-v">
              <span className={`dot ${active ? 'dot-good' : 'dot-warn'}`} /> {planLabel}
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-k">Status</span>
            <span className="meta-v">{profile?.isPaused === true ? 'Paused' : 'Active'}</span>
          </div>
          <div className="meta-row">
            <span className="meta-k">Renews</span>
            <span className="meta-v">
              {sub?.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : '—'}
            </span>
          </div>
          <div className="meta-row">
            <span className="meta-k">City</span>
            <span className="meta-v">{city}</span>
          </div>
        </div>
      </div>

      {error ? (
        <p className="notice">{error}</p>
      ) : loading ? (
        <p className="standfirst">Loading your home…</p>
      ) : !profile?.firstName ? (
        <p className="standfirst">Please complete your profile to get started.</p>
      ) : null}

      <section style={{ marginTop: 32 }}>
        <h2 className="section-title">
          <span className="rule" /> Today
        </h2>
        <ol className="index" start={1}>
          <li>
            <Link href="/portal/matches" className="index-link">
              <span className="index-no">01</span>
              <span className="index-body">
                <strong>Review your daily introductions</strong>
                <span className="muted">{dailyCount ?? 0} curated match(es) today.</span>
              </span>
            </Link>
          </li>
          <li>
            <Link href="/portal/messages" className="index-link">
              <span className="index-no">02</span>
              <span className="index-body">
                <strong>Open your conversations</strong>
                <span className="muted">Encrypted 1:1 chats with mutual matches.</span>
              </span>
            </Link>
          </li>
          <li>
            <Link href="/portal/events" className="index-link">
              <span className="index-no">03</span>
              <span className="index-body">
                <strong>See this month’s events</strong>
                <span className="muted">Invite-only mixers for verified members.</span>
              </span>
            </Link>
          </li>
        </ol>
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 className="section-title">
          <span className="rule" /> Members near you
        </h2>
        {preview.length === 0 ? (
          <p className="muted">More members are joining every day — check back soon.</p>
        ) : (
          <>
            <div className="member-grid">
              {preview.map((m) => (
                <div
                  className="member-card"
                  key={m.userId}
                  style={{ cursor: 'pointer' }}
                  role="button"
                  tabIndex={0}
                  onClick={() => openProfile(m.userId)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openProfile(m.userId);
                    }
                  }}
                  aria-label={`View profile of ${m.displayName ?? 'Member'}`}
                >
                  <div
                    className="member-photo"
                    style={m.photos.length ? { backgroundImage: `url(${m.photos[0]})` } : undefined}
                  >
                    {m.verified && <span className="badge badge-good member-flag">Verified</span>}
                  </div>
                  <div className="member-body">
                    <strong>
                      {m.displayName ?? 'Member'} · {m.age}
                    </strong>
                    <span className="muted">
                      {labelCity(m.city)}
                      {m.profession ? ` · ${m.profession}` : ''}
                    </span>
                    <button
                      type="button"
                      className="btn btn-subtle member-action"
                      onClick={(e) => {
                        e.stopPropagation();
                        openProfile(m.userId);
                      }}
                    >
                      View profile
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {!canConnect && (
              <p className="muted" style={{ marginTop: '0.75rem' }}>
                You can see who’s here, but connecting opens once you’re vetted.{' '}
                <Link href="/get-vetted" style={{ textDecoration: 'underline' }}>
                  Get vetted now
                </Link>
              </p>
            )}
          </>
        )}
      </section>

      <section style={{ marginTop: 32 }}>
        <h2 className="section-title">
          <span className="rule" /> Getting settled
        </h2>
        <ul className="ledger">
          {steps.map((s) => (
            <li key={s.label} className={`ledger-row ${s.done ? 'is-done' : ''}`}>
              <span className="ledger-mark">{s.done ? 'Done' : '·'}</span>
              <Link href={s.href} className="ledger-label">
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {!active && (
        <section className="cta-band" style={{ marginTop: 40 }}>
          <div>
            <h3 style={{ margin: 0 }}>Unlock unlimited matches and events.</h3>
            <p className="muted" style={{ margin: '4px 0 0' }}>
              Premium members see more introductions and get priority event access.
            </p>
          </div>
          <Link href="/portal/account" className="btn btn-solid">
            Upgrade
          </Link>
        </section>
      )}

      {profileId && (
        <HomeProfileModal
          userId={profileId}
          view={profileView}
          loading={profileLoading}
          onClose={closeProfile}
        />
      )}
    </>
  );
}

function HomeProfileModal({
  view,
  loading,
  onClose,
}: {
  userId: string;
  view: ProfileRedNoteView | null;
  loading: boolean;
  onClose: () => void;
}) {
  const [photoIdx, setPhotoIdx] = useState(0);
  const age = ageFromDob(view?.dateOfBirth);
  const photos = view?.photos?.length ? view.photos : [];

  useEffect(() => {
    setPhotoIdx(0);
  }, [view?.userId]);

  return (
    <div className="modal-shell" onClick={onClose}>
      <div className="modal-card match-profile-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title-row">
          <div className="modal-name">Member Profile</div>
          <button className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
        </div>

        {loading && (
          <div className="match-profile-empty">
            <span className="spinner" aria-label="Loading" />
            <p>Loading profile…</p>
          </div>
        )}

        {!loading && !view && (
          <div className="match-profile-empty">
            <p>Could not load profile.</p>
          </div>
        )}

        {view && (
          <>
            {photos.length > 0 ? (
              <>
                <div
                  className="match-profile-photos"
                  onScroll={(e) => {
                    const target = e.currentTarget;
                    const idx = Math.round(target.scrollLeft / target.clientWidth);
                    setPhotoIdx(idx);
                  }}
                >
                  {photos.map((url, i) => (
                    <div
                      key={`${url}-${i}`}
                      className="match-profile-photo"
                      style={{ backgroundImage: `url(${url})` }}
                      aria-label={`Photo ${i + 1} of ${photos.length}`}
                    />
                  ))}
                </div>
                {photos.length > 1 && (
                  <div className="match-profile-dots">
                    {photos.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        className={`match-profile-dot ${i === photoIdx ? 'is-on' : ''}`}
                        aria-label={`Photo ${i + 1}`}
                        onClick={() => setPhotoIdx(i)}
                      />
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div className="match-profile-empty">No photos</div>
            )}

            <div className="match-profile-meta">
              <h2 className="match-profile-name">
                {view.displayName ?? view.fullName ?? 'Member'}
                {age ? ` · ${age}` : null}
              </h2>
              <p className="match-profile-sub">
                {labelCity(view.location?.city)}
                {view.profession ? ` · ${view.profession}` : ''}
                {view.educationLevel ? ` · ${labelEducation(view.educationLevel)}` : ''}
              </p>
              <div className="match-profile-badges">
                {view.verified && <Badge tone="good">Verified</Badge>}
                {view.isPremium && <Badge tone="warn">Premium</Badge>}
              </div>
              {view.headline && (
                <p className="match-profile-bio">
                  <strong>{view.headline}</strong>
                </p>
              )}
              {view.bio && <p className="match-profile-bio">{view.bio}</p>}
              {view.industry && view.industry.length > 0 && (
                <p className="match-profile-bio" style={{ fontSize: '0.85rem', color: 'var(--muted)' }}>
                  {view.industry.join(' · ')}
                </p>
              )}
              <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
                <Link href="/portal/discover" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }}>
                  Discover &amp; Connect
                </Link>
                <button type="button" className="btn btn-ghost" onClick={onClose}>
                  Back
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

