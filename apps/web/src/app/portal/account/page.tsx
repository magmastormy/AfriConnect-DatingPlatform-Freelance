'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, uploadFile } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useClerkIdentity } from '@/lib/useClerkIdentity';
import { Card, ApiState, Button, Input, Select, Badge } from '@/components/ui';
import { ProfileBadges } from '@/components/ProfileBadges';
import { SubscriptionPlan, SubscriptionStatus, City, Gender, EducationLevel } from '@/lib/shared';
import { labelCity } from '@/lib/labels';
import Link from 'next/link';

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
  photos?: { url: string }[];
  completenessScore?: number;
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
  const [interestsText, setInterestsText] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [preferences, setPreferences] = useState({
    ageMin: 21,
    ageMax: 45,
    distanceKm: 50,
    educationMin: '' as EducationLevel | '',
    professions: '',
    relationshipGoals: '',
  });
  const [prefSaved, setPrefSaved] = useState<string | null>(null);

  const clerkName = [clerkUser?.firstName, clerkUser?.lastName].filter(Boolean).join(' ').trim();
  const displayName = profile?.firstName || clerkName || clerkUser?.email?.split('@')[0] || 'Member';

  useEffect(() => {
    void (async () => {
      try {
        const [p, s] = await Promise.all([
          api.get<Profile & { photos: { url: string }[] }>('/profile/me'),
          api.get<Sub | null>('/billing/subscription').catch(() => null),
        ]);
        setProfile(p as Profile);
        setSub(s);
        setInterestsText(Array.isArray(p.interests) ? p.interests.join(', ') : '');
        const withPhotos = p as unknown as { photos?: { url: string }[] };
        if (Array.isArray(withPhotos.photos)) setPhotos(withPhotos.photos.map((x) => x.url));
        const pref = p as unknown as { ageMin?: unknown; ageMax?: unknown; distanceKm?: unknown; educationMin?: unknown; professions?: unknown; relationshipGoals?: unknown };
        setPreferences({
          ageMin: Number((pref.ageMin as number | undefined) ?? 21),
          ageMax: Number((pref.ageMax as number | undefined) ?? 45),
          distanceKm: Number((pref.distanceKm as number | undefined) ?? 50),
          educationMin: (pref.educationMin as EducationLevel | undefined) ?? '',
          professions: Array.isArray(pref.professions) ? (pref.professions as string[]).join(', ') : '',
          relationshipGoals: Array.isArray(pref.relationshipGoals) ? (pref.relationshipGoals as string[]).join(', ') : '',
        });
      } catch (e) {
        setError(e instanceof ApiError ? e.message : 'Failed to load');
      } finally { setLoading(false); }
    })();
  }, []);

  async function save() {
    if (!profile) return;
    if (!profile.gender || !profile.city) { setError('Please select your gender and city before saving.'); return; }
    setBusy(true); setSavedMsg(null);
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
        interests: interestsText.split(',').map((s) => s.trim()).filter(Boolean),
        dateOfBirth: profile.dateOfBirth && profile.dateOfBirth.length >= 10 ? profile.dateOfBirth.slice(0, 10) : undefined,
      };
      const saved = await api.put<Profile & { isComplete?: boolean }>('/profile/me', payload);
      setProfile({ ...(saved as Profile) });
      const savedFlag = (saved as unknown as { isComplete?: boolean }).isComplete;
      setSavedMsg(savedFlag ? 'Profile saved — your profile is now complete.' : 'Profile saved. Add a clear profile image + 2 bio pics in the Photos section to reach 100%.');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Save failed'); }
    finally { setBusy(false); }
  }

  async function togglePause() {
    if (!profile) return;
    setBusy(true);
    try { await api.post('/profile/me/pause', { paused: !profile.isPaused }); setProfile({ ...profile, isPaused: !profile.isPaused }); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Action failed'); }
    finally { setBusy(false); }
  }

  async function savePreferences() {
    setBusy(true); setPrefSaved(null);
    try {
      await api.put('/profile/me/preferences', {
        ageMin: preferences.ageMin,
        ageMax: preferences.ageMax,
        distanceKm: preferences.distanceKm,
        educationMin: preferences.educationMin || undefined,
        professions: preferences.professions.split(',').map((s) => s.trim()).filter(Boolean),
        relationshipGoals: preferences.relationshipGoals.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setPrefSaved('Preferences saved — your daily matches will reflect this.');
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Failed to save preferences'); }
    finally { setBusy(false); }
  }

  async function handleAvatarUpload(file: File) {
    if (photos.length >= 3) { setError('Maximum 3 photos — remove one first.'); return; }
    setPhotoBusy(true);
    try {
      const { url } = await uploadFile(file, 'photos');
      await api.post('/profile/me/photos', { url, isPrimary: photos.length === 0 });
      setPhotos((p) => [...p, url]);
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Photo upload failed'); }
    finally { setPhotoBusy(false); }
  }

  async function removePhoto(url: string) {
    setPhotoBusy(true);
    try {
      try { await api.del(`/profile/me/photos?url=${encodeURIComponent(url)}`); } catch {}
      setPhotos((p) => p.filter((u) => u !== url));
    } finally { setPhotoBusy(false); }
  }

  async function makePrimary(idx: number) {
    if (idx === 0) return;
    const next = [...photos]; const [m] = next.splice(idx, 1); next.unshift(m); setPhotos(next);
  }

  async function startCheckout() {
    setBusy(true); setError(null);
    try {
      const { url } = await api.post<{ url: string }>('/billing/checkout-session', { plan: SubscriptionPlan.Premium, successUrl: window.location.origin, cancelUrl: window.location.origin });
      if (!url) throw new Error('No URL'); window.location.href = url;
    } catch (e) { setError(e instanceof ApiError ? e.message : 'Could not start checkout.'); setBusy(false); }
  }

  const completeness = profile ? Math.round(((profile.firstName ? 1 : 0) + (profile.bio ? 1 : 0) + (profile.profession ? 1 : 0) + (profile.employer ? 1 : 0) + (profile.educationLevel ? 1 : 0) + (photos.length > 0 ? 1 : 0) + (interestsText ? 1 : 0)) / 7 * 100) : 0;

  return (
    <div className="account-page">
      <div className="page-head">
        <h1>My profile</h1>
        <p>Your public card — photo-first, like Instagram. Complete it to be matched. You control what’s visible in Settings → Privacy.</p>
      </div>

      <ApiState loading={loading} error={error}>
        {profile && (
          <>
            {/* ── Hero: avatar + progress (FB cover style, IG avatar edit) ── */}
            <div className="acct-hero">
              <div className="acct-hero-cover" aria-hidden />
              <div className="acct-hero-main">
                <div className="acct-avatar-wrap">
                  {photos[0] ? <img src={photos[0]} alt="" className="acct-avatar" /> : clerkUser?.imageUrl ? <img src={clerkUser.imageUrl} alt="" className="acct-avatar" /> : <div className="acct-avatar fallback">{displayName.charAt(0).toUpperCase()}</div>}
                  <label className="acct-avatar-edit">
                    <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleAvatarUpload(f); e.target.value=''; }} />
                    <span>{photoBusy ? '…' : '✎'}</span>
                  </label>
                  {photos[0] && <span className="acct-primary-badge">Profile image</span>}
                </div>
                <div className="acct-hero-meta">
                  <div className="acct-hero-name">{displayName} {profile.isComplete && <span className="badge badge-good" style={{ verticalAlign: 'middle', marginLeft: 8 }}>Complete</span>}</div>
                  <div className="acct-hero-sub">{clerkUser?.email ?? ''} {profile.city ? `· ${labelCity(profile.city)}` : ''} {profile.profession ? `· ${profile.profession}` : ''}</div>
                  <div className="acct-progress">
                    <div className="acct-progress-bar"><i style={{ width: `${completeness}%` }} /></div>
                    <span className="acct-progress-label">{completeness}% complete</span>
                    {!profile.isComplete && <Link href="#photos" className="acct-progress-cta">Add photos to finish →</Link>}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Photos — prominent, 1+3 like IG ── */}
            <Card title="Photos" action={<Badge tone={photos.length >= 3 ? 'good' : 'warn'}>{photos.length}/3</Badge>}>
              <p className="muted" style={{ margin: '-4px 0 12px', fontSize: '.88rem' }}>First slot is your <b>profile image</b> (headshot). The other two are your bio pics. Tap to upload, drag primary. Everyone sees these on discovery.</p>
              <div className="acct-photo-grid" id="photos">
                {[0,1,2].map((idx) => {
                  const url = photos[idx];
                  return (
                    <div key={idx} className={`acct-photo-slot ${url ? 'has' : 'empty'} ${idx === 0 && url ? 'primary' : ''}`}>
                      {url ? (
                        <>
                          <img src={url} alt={`Photo ${idx+1}`} />
                          <div className="acct-photo-actions">
                            {idx !== 0 && <button type="button" className="btn btn-subtle" style={{ fontSize: '.74rem', padding: '4px 8px' }} onClick={() => makePrimary(idx)}>Make profile</button>}
                            <button type="button" className="btn btn-ghost" style={{ fontSize: '.74rem', padding: '4px 8px' }} onClick={() => removePhoto(url)}>Remove</button>
                          </div>
                          {idx===0 && <span className="acct-photo-tag">Profile image</span>}
                        </>
                      ) : (
                        <label className="acct-photo-empty">
                          <input type="file" accept="image/*" hidden onChange={(e)=>{ const f=e.target.files?.[0]; if(f) void handleAvatarUpload(f); e.target.value='';}} />
                          <span className="acct-photo-plus">＋</span>
                          <b>{idx===0 ? 'Add profile image' : `Add bio pic ${idx}`}</b>
                          <span>Tap to upload · JPG/PNG ≤5MB</span>
                        </label>
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="set-hint">Photos are AES-256-GCM encrypted at rest. Your first photo is what appears on every discovery card. <Link href="/portal/settings" style={{ fontWeight: 700 }}>Manage in Settings → Photos</Link></p>
            </Card>

            <Card title="About you" action={<Badge tone={profile.isComplete ? 'good' : 'warn'}>{profile.isComplete ? 'Complete' : `${completeness}%`}</Badge>}>
              <div className="grid2">
                <Input label="First name" value={profile.firstName || clerkUser?.firstName || ''} onChange={(e) => setProfile({ ...profile, firstName: e.currentTarget.value })} />
                <Input label="Last name" value={profile.lastName || clerkUser?.lastName || ''} onChange={(e) => setProfile({ ...profile, lastName: e.currentTarget.value })} />
                <Input label="Display name (public)" value={profile.displayName ?? ''} onChange={(e) => setProfile({ ...profile, displayName: e.currentTarget.value })} />
                <Input label="Profession" value={profile.profession ?? ''} onChange={(e) => setProfile({ ...profile, profession: e.currentTarget.value })} placeholder="e.g. Product Designer" />
                <Input label="Employer" value={profile.employer ?? ''} onChange={(e) => setProfile({ ...profile, employer: e.currentTarget.value })} />
                <Select label="City" value={profile.city} onChange={(e) => setProfile({ ...profile, city: e.currentTarget.value as City })}>
                  <option value="">Select city…</option>{Object.values(City).map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
                <Select label="Gender" value={profile.gender} onChange={(e) => setProfile({ ...profile, gender: e.currentTarget.value as Gender })}>
                  <option value="">Select gender…</option>{Object.values(Gender).map((g) => <option key={g} value={g}>{g}</option>)}
                </Select>
                <Select label="Education level" value={profile.educationLevel ?? ''} onChange={(e) => setProfile({ ...profile, educationLevel: e.currentTarget.value as EducationLevel })}>
                  <option value="">Select…</option>{Object.values(EducationLevel).map((l) => <option key={l} value={l}>{l}</option>)}
                </Select>
                <Input label="Date of birth" type="date" value={profile.dateOfBirth ? profile.dateOfBirth.slice(0,10) : ''} onChange={(e) => setProfile({ ...profile, dateOfBirth: e.currentTarget.value })} />
              </div>
              <label className="field"><span>Bio — what should someone know in 2 lines?</span><textarea value={profile.bio ?? ''} onChange={(e) => setProfile({ ...profile, bio: e.currentTarget.value })} placeholder="I’m a … who loves … Looking for …" rows={3} /></label>
              <label className="field"><span>Interests (comma-separated)</span><input value={interestsText} onChange={(e) => setInterestsText(e.target.value)} placeholder="e.g. Hiking, Jazz, Fintech" /></label>
              <div className="row-actions">
                <Button disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save profile'}</Button>
                <Button variant="ghost" disabled={busy} onClick={togglePause}>{profile.isPaused ? 'Resume profile (appear in Discover)' : 'Pause profile (hide me)'}</Button>
              </div>
              {savedMsg && <div className="notice" style={{ color: '#1a7f37', borderColor: '#1a7f37' }}>{savedMsg}</div>}
              {profile.isPaused && <div className="notice">Your profile is paused and hidden from matches.</div>}
            </Card>

            <Card title="Match Preferences" action={<span className="badge badge-neutral">Curation</span>}>
              <p className="muted" style={{ margin: '-4px 0 12px', fontSize: '.88rem' }}>Tune who you see in Discover — these feed your daily matches.</p>
              <div className="grid2">
                <Input label="Minimum age" type="number" value={String(preferences.ageMin)} onChange={(e) => setPreferences({ ...preferences, ageMin: Number(e.target.value) })} />
                <Input label="Maximum age" type="number" value={String(preferences.ageMax)} onChange={(e) => setPreferences({ ...preferences, ageMax: Number(e.target.value) })} />
                <Input label="Distance (km)" type="number" value={String(preferences.distanceKm)} onChange={(e) => setPreferences({ ...preferences, distanceKm: Number(e.target.value) })} />
                <Select label="Minimum education" value={preferences.educationMin} onChange={(e) => setPreferences({ ...preferences, educationMin: e.target.value as EducationLevel })}>
                  <option value="">Any</option>{Object.values(EducationLevel).map((l) => <option key={l} value={l}>{l}</option>)}
                </Select>
              </div>
              <Input label="Preferred professions (comma separated)" value={preferences.professions} onChange={(e) => setPreferences({ ...preferences, professions: e.target.value })} placeholder="e.g. Engineer, Doctor" />
              <Input label="Relationship goals (comma separated)" value={preferences.relationshipGoals} onChange={(e) => setPreferences({ ...preferences, relationshipGoals: e.target.value })} placeholder="e.g. Marriage, Long term" />
              <div className="row-actions">
                <Button disabled={busy} onClick={savePreferences}>{busy ? 'Saving…' : 'Save preferences'}</Button>
                <Link href="/portal/discover" className="btn btn-ghost">Preview Discover →</Link>
              </div>
              {prefSaved && <div className="notice" style={{ color: '#1a7f37', borderColor: '#1a7f37' }}>{prefSaved}</div>}
            </Card>

            <Card title="Membership status"><ProfileBadges sub={sub} stage={stage} applicationStatus={applicationStatus} /></Card>

            <Card title="Membership" action={sub ? <Badge tone={sub.status === SubscriptionStatus.Active ? 'good' : 'warn'}>{sub.status}</Badge> : null}>
              {sub ? <p style={{ color: 'var(--muted)' }}>Plan: <strong>{sub.plan}</strong> · Renews {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : '—'}</p> : <p style={{ color: 'var(--muted)' }}>Free tier. Upgrade for unlimited matches and events.</p>}
              <Button disabled={busy} onClick={startCheckout}>Upgrade to Premium</Button>
            </Card>
          </>
        )}
      </ApiState>
    </div>
  );
}
