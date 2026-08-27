'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { SubscriptionStatus } from '@/lib/shared';
import { useAuth } from '@/lib/auth';
import { can, Capability, MembershipStage } from '@/lib/membership';
import { DiscoverCard } from '@/lib/types';
import { labelCity } from '@/lib/labels';

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

export default function PortalDashboard() {
  const { stage } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [dailyCount, setDailyCount] = useState<number | null>(null);
  const [preview, setPreview] = useState<DiscoverCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
                <div className="member-card" key={m.userId}>
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
                    {canConnect ? (
                      <Link href="/portal/discover" className="btn btn-subtle member-action">
                        View &amp; connect
                      </Link>
                    ) : (
                      <Link href="/get-vetted" className="btn btn-subtle member-action">
                        Get vetted to connect
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {!canConnect && (
              <p className="muted" style={{ marginTop: '0.75rem' }}>
                You can see who’s here, but connecting opens once you’re vetted.
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
              <span className="ledger-mark">{s.done ? '✓' : '·'}</span>
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
    </>
  );
}
