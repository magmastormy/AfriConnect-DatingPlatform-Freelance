'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { Card, ApiState, Button, Input, Select, Badge } from '@/components/ui';
import { SubscriptionPlan, SubscriptionStatus, City, Gender } from '@africonnect/shared';

interface Profile {
  firstName: string;
  lastName: string;
  displayName: string | null;
  bio: string | null;
  city: City;
  gender: Gender;
  profession: string | null;
  employer: string | null;
  isComplete: boolean;
  isPaused: boolean;
}
interface Sub {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
}

export default function AccountPage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [p, s] = await Promise.all([
          api.get<Profile>('/profile/me'),
          api.get<Sub | null>('/billing/subscription').catch(() => null),
        ]);
        setProfile(p);
        setSub(s);
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    if (!profile) return;
    setBusy(true);
    try {
      await api.put('/profile/me', {
        firstName: profile.firstName,
        lastName: profile.lastName,
        displayName: profile.displayName,
        bio: profile.bio,
        city: profile.city,
        gender: profile.gender,
        profession: profile.profession,
        employer: profile.employer,
      });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function togglePause() {
    if (!profile) return;
    setBusy(true);
    try {
      await api.post('/profile/me/pause', { paused: !profile.isPaused });
      setProfile({ ...profile, isPaused: !profile.isPaused });
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Action failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h1>Account</h1>
        <p>Manage your profile and membership.</p>
      </div>
      <ApiState loading={loading} error={error}>
        {profile && (
          <Card
            title="Profile"
            action={
              <Badge tone={profile.isComplete ? 'good' : 'warn'}>
                {profile.isComplete ? 'Complete' : 'Incomplete'}
              </Badge>
            }
          >
            <div className="grid2">
              <Input
                label="First name"
                value={profile.firstName}
                onChange={(e) => setProfile({ ...profile, firstName: e.currentTarget.value })}
              />
              <Input
                label="Last name"
                value={profile.lastName}
                onChange={(e) => setProfile({ ...profile, lastName: e.currentTarget.value })}
              />
              <Input
                label="Display name"
                value={profile.displayName ?? ''}
                onChange={(e) => setProfile({ ...profile, displayName: e.currentTarget.value })}
              />
              <Input
                label="Profession"
                value={profile.profession ?? ''}
                onChange={(e) => setProfile({ ...profile, profession: e.currentTarget.value })}
              />
              <Select
                label="City"
                value={profile.city}
                onChange={(e) => setProfile({ ...profile, city: e.currentTarget.value as City })}
              >
                {Object.values(City).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </Select>
              <Select
                label="Gender"
                value={profile.gender}
                onChange={(e) =>
                  setProfile({ ...profile, gender: e.currentTarget.value as Gender })
                }
              >
                {Object.values(Gender).map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </div>
            <label className="field">
              <span>Bio</span>
              <textarea
                value={profile.bio ?? ''}
                onChange={(e) => setProfile({ ...profile, bio: e.currentTarget.value })}
              />
            </label>
            <div className="row-actions">
              <Button disabled={busy} onClick={save}>
                Save profile
              </Button>
              <Button variant="ghost" disabled={busy} onClick={togglePause}>
                {profile.isPaused ? 'Resume profile' : 'Pause profile'}
              </Button>
            </div>
            {profile.isPaused && (
              <div className="notice">Your profile is paused and hidden from matches.</div>
            )}
          </Card>
        )}

        <Card
          title="Membership"
          action={
            sub ? (
              <Badge tone={sub.status === SubscriptionStatus.Active ? 'good' : 'warn'}>
                {sub.status}
              </Badge>
            ) : null
          }
        >
          {sub ? (
            <p style={{ color: 'var(--muted)' }}>
              Plan: <strong>{sub.plan}</strong> · Renews{' '}
              {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : '—'}
            </p>
          ) : (
            <p style={{ color: 'var(--muted)' }}>
              Free tier. Upgrade for unlimited matches and events.
            </p>
          )}
          <Button
            onClick={() =>
              api
                .post<{ url: string }>('/billing/checkout-session', {
                  plan: SubscriptionPlan.Premium,
                  successUrl: window.location.origin,
                  cancelUrl: window.location.origin,
                })
                .then((r: { url: string }) => {
                  window.location.href = r.url;
                })
            }
          >
            Upgrade to Premium
          </Button>
        </Card>
      </ApiState>
    </div>
  );
}
