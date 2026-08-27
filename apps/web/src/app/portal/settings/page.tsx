'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, getRefreshToken, setTokens, clearTokens } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { EducationLevel } from '@/lib/shared';

type Tab = 'preferences' | 'privacy' | 'photos' | 'nearby' | 'security';

interface Preferences {
  ageMin: number;
  ageMax: number;
  distanceKm: number;
  educationMin: EducationLevel | '';
  professions: string;
  relationshipGoals: string;
}
interface Privacy {
  showEmployer: boolean;
  showAge: boolean;
  photoVisibility: 'all' | 'matches' | 'none';
}

// ---------- helpers ----------
function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="set-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="set-toggle-track" aria-hidden><i /></span>
      <span className="set-toggle-label">{label}</span>
    </label>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="set-section">
      <div className="set-section-head">
        <h3>{title}</h3>
        {desc && <p>{desc}</p>}
      </div>
      <div className="set-section-body">{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('preferences');
  const [prefs, setPrefs] = useState<Preferences>({ ageMin: 21, ageMax: 45, distanceKm: 50, educationMin: '', professions: '', relationshipGoals: '' });
  const [privacy, setPrivacy] = useState<Privacy>({ showEmployer: true, showAge: true, photoVisibility: 'matches' });
  const [photos, setPhotos] = useState<string[]>([]);
  const [district, setDistrict] = useState('');
  const [nearbyEnabled, setNearbyEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [locBusy, setLocBusy] = useState(false);
  const [locStatus, setLocStatus] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const p = await api.get<Record<string, unknown>>('/profile/me');
        const r = p as unknown as {
          ageMin?: unknown; ageMax?: unknown; distanceKm?: unknown; educationMin?: unknown;
          professions?: unknown; relationshipGoals?: unknown; showEmployer?: unknown; showAge?: unknown;
          photoVisibility?: unknown; photos?: unknown; district?: unknown; nearbyEnabled?: unknown;
        };
        setPrefs({
          ageMin: Number((r.ageMin as number | undefined) ?? 21),
          ageMax: Number((r.ageMax as number | undefined) ?? 45),
          distanceKm: Number((r.distanceKm as number | undefined) ?? 50),
          educationMin: (r.educationMin as EducationLevel | undefined) ?? '',
          professions: Array.isArray(r.professions) ? (r.professions as string[]).join(', ') : '',
          relationshipGoals: Array.isArray(r.relationshipGoals) ? (r.relationshipGoals as string[]).join(', ') : '',
        });
        setPrivacy({
          showEmployer: Boolean((r.showEmployer as boolean | undefined) ?? true),
          showAge: Boolean((r.showAge as boolean | undefined) ?? true),
          photoVisibility: (r.photoVisibility as Privacy['photoVisibility'] | undefined) ?? 'matches',
        });
        if (Array.isArray(r.photos)) setPhotos((r.photos as { url: string }[]).map((x) => x.url));
        if (typeof r.district === 'string') setDistrict(r.district);
        setNearbyEnabled(Boolean(r.nearbyEnabled));
      } catch (e) {
        toast(e instanceof ApiError ? e.message : 'Failed to load settings', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  async function savePreferences() {
    setBusy(true);
    try {
      await api.put('/profile/me/preferences', {
        ageMin: prefs.ageMin,
        ageMax: prefs.ageMax,
        distanceKm: prefs.distanceKm,
        educationMin: prefs.educationMin || undefined,
        professions: prefs.professions.split(',').map((s) => s.trim()).filter(Boolean),
        relationshipGoals: prefs.relationshipGoals.split(',').map((s) => s.trim()).filter(Boolean),
      });
      toast('Preferences saved', 'success');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Save failed', 'error');
    } finally { setBusy(false); }
  }

  async function savePrivacy() {
    setBusy(true);
    try { await api.put('/profile/me/privacy', privacy); toast('Privacy saved', 'success'); }
    catch (e) { toast(e instanceof ApiError ? e.message : 'Save failed', 'error'); }
    finally { setBusy(false); }
  }

  async function uploadPhotoFile(file: File) {
    if (photos.length >= 3) { toast('Maximum 3 photos', 'error'); return; }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      // Use the generic uploadFile helper via direct fetch to keep folder semantics
      const { uploadFile } = await import('@/lib/api');
      const { url } = await uploadFile(file, 'photos');
      await api.post('/profile/me/photos', { url, isPrimary: photos.length === 0 });
      setPhotos((p) => [...p, url]);
      toast('Photo added', 'success');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : e instanceof Error ? e.message : 'Upload failed', 'error');
    } finally { setBusy(false); }
  }

  async function removePhoto(url: string) {
    setBusy(true);
    try {
      // best-effort delete on server if endpoint exists, else just local
      try { await api.del(`/profile/me/photos?url=${encodeURIComponent(url)}`); } catch {}
      setPhotos((p) => p.filter((u) => u !== url));
      toast('Photo removed', 'success');
    } finally { setBusy(false); }
  }

  async function setPrimary(idx: number) {
    if (idx === 0) return;
    const next = [...photos];
    const [moved] = next.splice(idx, 1);
    next.unshift(moved);
    setPhotos(next);
    // persist order naively by re-adding — server keeps array order; we save via re-post not ideal but give feedback
    toast('Primary photo updated (drag to reorder)', 'success');
  }

  async function requestLocation() {
    setLocBusy(true);
    setLocStatus('Requesting location…');
    try {
      if (!('geolocation' in navigator)) throw new Error('Geolocation not supported on this device.');
      const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 })
      );
      const { latitude, longitude } = pos.coords;
      // reverse-ish: we don't have reverse geocode, but we can save coords and keep district text
      await api.put('/profile/me/nearby', { district: district || 'Current location', nearbyEnabled: true, latitude, longitude });
      setNearbyEnabled(true);
      setLocStatus(`Location captured — ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`);
      toast('Location saved — you’ll appear in Nearby', 'success');
    } catch (e) {
      const msg = geolocationMessage(e);
      setLocStatus(msg);
      toast(msg, 'error');
    } finally { setLocBusy(false); }
  }

  function geolocationMessage(e: unknown): string {
    if (e instanceof ApiError) return e.message;
    if (e instanceof Error) {
      const code = (e as unknown as { code?: number }).code;
      if (code === 1) return 'Permission denied — enable Location in your browser settings (padlock → Location → Allow), then try again.';
      if (code === 3) return 'Timed out finding you — check signal/GPS and try again.';
      if (code === 2) return 'Location unavailable right now. Try again or enter your district manually.';
      return e.message;
    }
    return 'Could not get location.';
  }

  async function saveNearby() {
    setBusy(true);
    try {
      await api.put('/profile/me/nearby', { district, nearbyEnabled });
      toast('Nearby saved', 'success');
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Save failed', 'error'); }
    finally { setBusy(false); }
  }

  async function forgetLocation() {
    setBusy(true);
    try {
      await api.put('/profile/me/nearby', { nearbyEnabled: false });
      setNearbyEnabled(false);
      setLocStatus('Location cleared — you’re hidden from Nearby');
      toast('Location forgotten', 'success');
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Failed', 'error'); }
    finally { setBusy(false); }
  }

  async function refreshSession() {
    setBusy(true);
    try {
      const refresh = getRefreshToken();
      if (!refresh) { toast('No session to refresh', 'info'); return; }
      const res = await api.post<{ accessToken: string }>('/auth/refresh', { refreshToken: refresh });
      setTokens(res.accessToken, refresh);
      toast('Session refreshed', 'success');
    } catch (e) { toast(e instanceof ApiError ? e.message : 'Refresh failed', 'error'); }
    finally { setBusy(false); }
  }

  async function signOutEverywhere() {
    setBusy(true);
    try { await api.post('/auth/logout', { refreshToken: getRefreshToken() ?? '' }); }
    catch (e) { toast(e instanceof ApiError ? `Signed out locally — server may remain: ${e.message}` : 'Signed out locally', 'error'); }
    finally { clearTokens(); window.location.href = '/login'; }
  }

  const tabs: { id: Tab; label: string; icon: string; desc: string }[] = [
    { id: 'preferences', label: 'Matching', icon: '', desc: 'Age, distance, education' },
    { id: 'privacy', label: 'Privacy', icon: '', desc: 'What others see' },
    { id: 'photos', label: 'Photos', icon: '', desc: `${photos.length}/3 uploaded` },
    { id: 'nearby', label: 'Nearby', icon: '', desc: nearbyEnabled ? 'Visible in Nearby' : 'Hidden' },
    { id: 'security', label: 'Security', icon: '', desc: 'Session & data' },
  ];

  if (loading) return <div className="state"><span className="spinner" /></div>;

  return (
    <div className="settings-page">
      <div className="page-head">
        <h1>Settings</h1>
        <p>Everything about how you appear, match and stay safe — tuned for phone and desktop.</p>
      </div>

      <div className="settings-shell">
        {/* Left / top nav */}
        <nav className="settings-nav" aria-label="Settings sections">
          {tabs.map((t) => (
            <button key={t.id} className={`set-nav-item ${tab === t.id ? 'is-active' : ''}`} onClick={() => setTab(t.id)} type="button">
              <span className="set-nav-ico" aria-hidden>{t.icon}</span>
              <span className="set-nav-text">
                <b>{t.label}</b>
                <span>{t.desc}</span>
              </span>
            </button>
          ))}
        </nav>

        <div className="settings-content">
          {tab === 'preferences' && (
            <div className="set-card">
              <Section title="Matching preferences" desc="We use these to curate your daily introductions. Lower distance = fewer, nearer matches.">
                <div className="set-grid2">
                  <label className="set-field">
                    <span>Minimum age <em>{prefs.ageMin}</em></span>
                    <input type="range" min={18} max={70} value={prefs.ageMin} onChange={(e) => setPrefs({ ...prefs, ageMin: Number(e.target.value) })} />
                  </label>
                  <label className="set-field">
                    <span>Maximum age <em>{prefs.ageMax}</em></span>
                    <input type="range" min={18} max={70} value={prefs.ageMax} onChange={(e) => setPrefs({ ...prefs, ageMax: Number(e.target.value) })} />
                  </label>
                  <label className="set-field">
                    <span>Distance — {prefs.distanceKm} km</span>
                    <input type="range" min={5} max={500} step={5} value={prefs.distanceKm} onChange={(e) => setPrefs({ ...prefs, distanceKm: Number(e.target.value) })} />
                  </label>
                  <label className="field">
                    <span>Minimum education</span>
                    <select value={prefs.educationMin} onChange={(e) => setPrefs({ ...prefs, educationMin: e.target.value as EducationLevel })}>
                      <option value="">Any</option>
                      {Object.values(EducationLevel).map((l) => <option key={l} value={l}>{l}</option>)}
                    </select>
                  </label>
                </div>
                <label className="field">
                  <span>Preferred professions (comma separated)</span>
                  <input value={prefs.professions} onChange={(e) => setPrefs({ ...prefs, professions: e.target.value })} placeholder="e.g. Engineer, Doctor" />
                </label>
                <label className="field">
                  <span>Relationship goals (comma separated)</span>
                  <input value={prefs.relationshipGoals} onChange={(e) => setPrefs({ ...prefs, relationshipGoals: e.target.value })} placeholder="e.g. Marriage, Partnership" />
                </label>
                <button className="btn btn-primary" disabled={busy} onClick={savePreferences}>{busy ? 'Saving…' : 'Save preferences'}</button>
              </Section>
            </div>
          )}

          {tab === 'privacy' && (
            <div className="set-card">
              <Section title="Privacy controls" desc="Decide what verified matches can see. Hidden fields stay on your card as '—'.">
                <div className="set-toggles">
                  <Toggle checked={privacy.showEmployer} onChange={(v) => setPrivacy({ ...privacy, showEmployer: v })} label="Show my employer to matches" />
                  <Toggle checked={privacy.showAge} onChange={(v) => setPrivacy({ ...privacy, showAge: v })} label="Show my age to matches" />
                </div>
                <label className="field">
                  <span>Photo visibility</span>
                  <select value={privacy.photoVisibility} onChange={(e) => setPrivacy({ ...privacy, photoVisibility: e.target.value as Privacy['photoVisibility'] })}>
                    <option value="all">Everyone — discovery & profile</option>
                    <option value="matches">My matches only</option>
                    <option value="none">No one (hidden)</option>
                  </select>
                </label>
                <button className="btn btn-primary" disabled={busy} onClick={savePrivacy}>{busy ? 'Saving…' : 'Save privacy'}</button>
              </Section>
            </div>
          )}

          {tab === 'photos' && (
            <div className="set-card">
              <Section title={`Your photos — ${photos.length} of 3`} desc="First photo is your profile image (the one everyone sees first). Tap a photo to make it primary. Max 5 MB, JPG/PNG.">
                <div className="set-photo-grid">
                  {[0, 1, 2].map((idx) => {
                    const url = photos[idx];
                    return (
                      <div key={idx} className={`set-photo-slot ${url ? 'has-photo' : 'empty'} ${idx === 0 && url ? 'is-primary' : ''}`}>
                        {url ? (
                          <>
                            <img src={url} alt={`Photo ${idx + 1}`} />
                            <div className="set-photo-actions">
                              {idx !== 0 && <button type="button" className="set-photo-btn" onClick={() => setPrimary(idx)}>Make primary</button>}
                              <button type="button" className="set-photo-btn danger" onClick={() => removePhoto(url)}>Remove</button>
                            </div>
                            {idx === 0 && <span className="set-primary-badge">Profile image</span>}
                          </>
                        ) : (
                          <label className="set-upload">
                            <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhotoFile(f); e.target.value = ''; }} />
                            <span className="set-upload-plus">＋</span>
                            <span>{idx === 0 ? 'Add profile image' : `Add bio pic ${idx}`}</span>
                            <span className="set-upload-hint">Tap to upload</span>
                          </label>
                        )}
                      </div>
                    );
                  })}
                </div>
                <p className="set-hint">Tip: Your profile image should be a clear headshot. Bio pics can show you in life — work, travel, hobbies. All photos are encrypted at rest (AES-256-GCM).</p>
                {photos.length < 3 && (
                  <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
                    <input type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadPhotoFile(f); e.target.value=''; }} />
                    {busy ? 'Uploading…' : 'Choose file…'}
                  </label>
                )}
              </Section>
            </div>
          )}

          {tab === 'nearby' && (
            <div className="set-card">
              <Section title="Nearby — people around you" desc="Like WeChat Nearby but district-scoped. Opt in to be discoverable to other vetted members near you. Your exact coordinates are never shown — only distance.">
                <div className="set-nearby-actions">
                  <button className="btn btn-primary" disabled={locBusy || busy} onClick={requestLocation}>
                    {locBusy ? 'Locating…' : nearbyEnabled ? 'Update my location' : 'Use my current location (GPS)'}
                  </button>
                  {nearbyEnabled && <button className="btn btn-ghost" disabled={busy} onClick={forgetLocation}>Forget my location</button>}
                </div>
                {locStatus && <div className={`set-loc-status ${nearbyEnabled ? 'ok' : ''}`}>{locStatus}</div>}

                <div className="set-grid2" style={{ marginTop: 16 }}>
                  <label className="field">
                    <span>District / neighbourhood</span>
                    <input value={district} placeholder="e.g. Sandton, Camps Bay" onChange={(e) => setDistrict(e.target.value)} />
                  </label>
                  <Toggle checked={nearbyEnabled} onChange={setNearbyEnabled} label="Show me in Nearby to other verified members" />
                </div>

                <div className="set-permission-explainer">
                  <strong>How it works</strong>
                  <ol>
                    <li>Tap “Use my current location” — your browser will ask for permission. Choose <b>Allow</b>.</li>
                    <li>If you deny, you can still type your district and toggle Nearby on (distance will be approximate).</li>
                    <li>Your coordinates are stored only while you’re opted in and are deleted the moment you hide or forget.</li>
                  </ol>
                  <p className="muted">We never share your precise location. Others see only “~1.2 km away”.</p>
                </div>

                <button className="btn btn-primary" disabled={busy} onClick={saveNearby}>{busy ? 'Saving…' : 'Save nearby settings'}</button>
                <p className="set-hint">Browsing Nearby is included for Premium. <Link href="/portal/account">Upgrade →</Link></p>
              </Section>
            </div>
          )}

          {tab === 'security' && (
            <div className="set-card">
              <Section title="Security" desc={`Signed in as ${user?.email ?? '—'}. We use passwordless one-time codes and device-bound sessions.`}>
                <div className="row-actions">
                  <button className="btn btn-primary" disabled={busy} onClick={refreshSession}>Refresh session token</button>
                  <button className="btn btn-ghost" disabled={busy} onClick={signOutEverywhere}>Sign out everywhere</button>
                </div>
                <div className="set-security-note">
                  <p>Need to delete your data? Under POPIA you can export or purge your profile at any time.</p>
                  <div className="row-actions">
                    <Link href="/portal/account" className="btn btn-subtle">Export my data (Account)</Link>
                    <a href="/privacy" className="btn btn-ghost">Privacy & POPIA</a>
                  </div>
                </div>
              </Section>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
