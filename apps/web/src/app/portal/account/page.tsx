'use client';

import { useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useClerkIdentity } from '@/lib/useClerkIdentity';
import { Card, ApiState, Button, Input, Select, Badge } from '@/components/ui';
import { ProfileBadges } from '@/components/ProfileBadges';
import { SubscriptionPlan, SubscriptionStatus, City, Gender, EducationLevel } from '@/lib/shared';

interface Profile {
  firstName: string;
  lastName: string;
  displayName: string | null;
  bio: string | null;
  city: City;
  gender: Gender;
  profession: string | null;
  employer: string | null;
  educationLevel: EducationLevel | null;
  dateOfBirth: string | null;
  interests: string[] | null;
  isComplete: boolean;
  isPaused: boolean;
}
interface Sub {
  plan: SubscriptionPlan;
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
}

export default function AccountPage() {
  const { stage, applicationStatus } = useAuth();
  const { user: clerkUser } = useClerkIdentity();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sub, setSub] = useState<Sub | null>(null);
  // Raw, unsplit interests text. Kept separate from profile.interests (the
  // string[] the server expects) so the textbox behaves like a normal input —
  // commas are preserved while typing and only converted to an array on save.
  const [interestsText, setInterestsText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Seed the form from Clerk identity when the backend profile is still empty,
  // so a member who signed up via Clerk sees their real name immediately
  // instead of blank fields, and saving it persists it to the database.
  const clerkName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ').trim();
  const displayName =
    profile?.firstName || clerkName || clerkUser?.email?.split('@')[0] || 'Member';

  useEffect(() => {
    void (async () => {
      try {
        const [p, s] = await Promise.all([
          api.get<Profile>('/profile/me'),
          api.get<Sub | null>('/billing/subscription').catch(() => null),
        ]);
        setProfile(p);
        setSub(s);
        setInterestsText(Array.isArray(p.interests) ? p.interests.join(', ') : '');
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function save() {
    if (!profile) return;
    if (!profile.gender || !profile.city) {
      setError('Please select your gender and city before saving.');
      return;
    }
    setBusy(true);
    setSavedMsg(null);
    try {
      const payload = {
        firstName: profile.firstName || clerkUser?.firstName || '',
        lastName: profile.lastName || clerkUser?.lastName || '',
        displayName: profile.displayName,
        bio: profile.bio,
        city: profile.city,
        gender: profile.gender,
        profession: profile.profession,
        employer: profile.employer,
        educationLevel: profile.educationLevel ?? undefined,
        interests: interestsText
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        // The API returns dateOfBirth as a full ISO datetime string
      // (e.g. "1990-05-15T00:00:00.000Z"), but the updateProfile Zod schema
      // requires strict YYYY-MM-DD — slice to the date portion to avoid a 400
      // validation error on every save.
      dateOfBirth:
        profile.dateOfBirth && profile.dateOfBirth.length >= 10
          ? profile.dateOfBirth.slice(0, 10)
          : undefined,
      };
      const saved = await api.put<Profile>('/profile/me', payload);
      setProfile({ ...saved });
      setSavedMsg(
        saved.isComplete
          ? 'Profile saved — your profile is now complete.'
          : 'Profile saved. Fill bio, profession, employer, education level, interests, and add a photo (Settings → Photos) to reach 100%.',
      );
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

  // Previously an unhandled `.then()` chain: if creating the checkout session
  // failed, the promise rejected with no handler and the button appeared dead —
  // no redirect, no error. On the revenue path that is the worst failure mode.
  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const { url } = await api.post<{ url: string }>('/billing/checkout-session', {
        plan: SubscriptionPlan.Premium,
        successUrl: window.location.origin,
        cancelUrl: window.location.origin,
      });
      if (!url) throw new Error('Checkout session did not return a redirect URL');
      window.location.href = url;
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Could not start checkout. Please try again.');
      setBusy(false); // only reset on failure; success navigates away
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
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '0.9rem', marginBottom: '1rem' }}
            >
              {clerkUser?.imageUrl ? (
                <img
                  src={clerkUser.imageUrl}
                  alt=""
                  style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: '50%',
                    display: 'grid',
                    placeItems: 'center',
                    background: 'var(--brand)',
                    color: 'var(--on-brand)',
                    fontWeight: 800,
                    fontSize: '1.2rem',
                  }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{displayName}</div>
                {clerkUser?.email && (
                  <div style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                    {clerkUser.email}
                  </div>
                )}
              </div>
            </div>

            <div className="grid2">
              <Input
                label="First name"
                value={profile.firstName || clerkUser?.firstName || ''}
                onChange={(e) => setProfile({ ...profile, firstName: e.currentTarget.value })}
              />
              <Input
                label="Last name"
                value={profile.lastName || clerkUser?.lastName || ''}
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
              <Input
                label="Employer"
                value={profile.employer ?? ''}
                onChange={(e) => setProfile({ ...profile, employer: e.currentTarget.value })}
              />
              <Select
                label="City"
                value={profile.city}
                onChange={(e) => setProfile({ ...profile, city: e.currentTarget.value as City })}
              >
                <option value="">Select city…</option>
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
                <option value="">Select gender…</option>
                {Object.values(Gender).map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
              <Select
                label="Education level"
                value={profile.educationLevel ?? ''}
                onChange={(e) =>
                  setProfile({ ...profile, educationLevel: e.currentTarget.value as EducationLevel })
                }
              >
                <option value="">Select…</option>
                {Object.values(EducationLevel).map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </Select>
              <Input
                label="Date of birth"
                type="date"
                value={profile.dateOfBirth ? profile.dateOfBirth.slice(0, 10) : ''}
                onChange={(e) => setProfile({ ...profile, dateOfBirth: e.currentTarget.value })}
              />
            </div>
            <label className="field">
              <span>Bio</span>
              <textarea
                value={profile.bio ?? ''}
                onChange={(e) => setProfile({ ...profile, bio: e.currentTarget.value })}
              />
            </label>
            <label className="field">
              <span>Interests (comma-separated)</span>
              <input
                value={interestsText}
                onChange={(e) => setInterestsText(e.currentTarget.value)}
                placeholder="e.g. Hiking, Jazz, Fintech"
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
            {savedMsg && <div className="notice" style={{ color: '#1a7f37', borderColor: '#1a7f37' }}>{savedMsg}</div>}
            {profile.isPaused && (
              <div className="notice">Your profile is paused and hidden from matches.</div>
            )}
          </Card>
        )}

        <Card title="Membership status">
          <ProfileBadges sub={sub} stage={stage} applicationStatus={applicationStatus} />
        </Card>

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
          <Button disabled={busy} onClick={startCheckout}>
            Upgrade to Premium
          </Button>
        </Card>
      </ApiState>
    </div>
  );
}
