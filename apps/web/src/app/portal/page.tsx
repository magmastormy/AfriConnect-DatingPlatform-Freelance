'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { PortalShell } from '@/components/PortalShell';
import { SubscriptionStatus } from '@africonnect/shared';

interface Profile {
  firstName: string;
  lastName: string;
  city: string;
  profession: string | null;
  isComplete: boolean;
  isPaused: boolean;
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
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [dailyCount, setDailyCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, s, d] = await Promise.all([
          api.get<Profile>('/profile/me'),
          api.get<Sub | null>('/billing/subscription').catch(() => null),
          api
            .get<{ matches: unknown[] }>('/matches/daily')
            .then((r) => r.matches.length)
            .catch(() => 0),
        ]);
        setProfile(p);
        setSub(s);
        setDailyCount(d);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const planLabel = sub ? sub.plan : 'Free';
  const active = sub?.status === SubscriptionStatus.Active;
  const city = profile ? (CITIES[profile.city] ?? profile.city) : '—';
  const name = profile ? `${profile.firstName}` : 'Member';

  const steps: { label: string; done: boolean; href: string }[] = [
    { label: 'Complete your profile', done: !!profile?.isComplete, href: '/portal/account' },
    { label: 'Verify your identity', done: false, href: '/portal/account' },
    { label: 'Review today’s introductions', done: (dailyCount ?? 0) > 0, href: '/portal/matches' },
    {
      label: 'Resume your profile to be matched',
      done: !profile?.isPaused,
      href: '/portal/account',
    },
  ];

  return (
    <PortalShell>
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
            <span className="meta-v">{profile?.isPaused ? 'Paused' : 'Active'}</span>
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
    </PortalShell>
  );
}
