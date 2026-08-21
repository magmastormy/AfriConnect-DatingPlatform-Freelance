'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api, ApiError, getRefreshToken, setTokens, clearTokens } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { Card, Button, Input, Select } from '@/components/ui';
import { FileUpload } from '@/components/FileUpload';
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

export function SettingsPanel() {
  const { user } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>('preferences');
  const [prefs, setPrefs] = useState<Preferences>({
    ageMin: 21,
    ageMax: 45,
    distanceKm: 50,
    educationMin: '',
    professions: '',
    relationshipGoals: '',
  });
  const [privacy, setPrivacy] = useState<Privacy>({
    showEmployer: true,
    showAge: true,
    photoVisibility: 'matches',
  });
  const [photos, setPhotos] = useState<string[]>([]);
  const [district, setDistrict] = useState('');
  const [nearbyEnabled, setNearbyEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const p = await api.get<Record<string, unknown>>('/profile/me');
        setPrefs({
          ageMin: Number(p.ageMin ?? 21),
          ageMax: Number(p.ageMax ?? 45),
          distanceKm: Number(p.distanceKm ?? 50),
          educationMin: (p.educationMin as EducationLevel) ?? '',
          professions: Array.isArray(p.professions) ? p.professions.join(', ') : '',
          relationshipGoals: Array.isArray(p.relationshipGoals)
            ? p.relationshipGoals.join(', ')
            : '',
        });
        setPrivacy({
          showEmployer: Boolean(p.showEmployer ?? true),
          showAge: Boolean(p.showAge ?? true),
          photoVisibility: (p.photoVisibility as Privacy['photoVisibility']) ?? 'matches',
        });
        if (Array.isArray(p.photos)) setPhotos(p.photos.map((x: { url: string }) => x.url));
        if (typeof p.district === 'string') setDistrict(p.district);
        setNearbyEnabled(Boolean(p.nearbyEnabled));
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
        professions: prefs.professions
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
        relationshipGoals: prefs.relationshipGoals
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      });
      toast('Preferences saved', 'success');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function savePrivacy() {
    setBusy(true);
    try {
      await api.put('/profile/me/privacy', privacy);
      toast('Privacy saved', 'success');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function addPhoto(url: string) {
    setBusy(true);
    try {
      await api.post('/profile/me/photos', { url, isPrimary: photos.length === 0 });
      setPhotos((p) => [...p, url]);
      toast('Photo added', 'success');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Add failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function saveNearby() {
    setBusy(true);
    try {
      await api.put('/profile/me/nearby', { district, nearbyEnabled });
      toast('Nearby settings saved', 'success');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Save failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function refreshSession() {
    setBusy(true);
    try {
      const refresh = getRefreshToken();
      if (!refresh) {
        toast('No session to refresh', 'info');
        return;
      }
      const res = await api.post<{ accessToken: string }>('/auth/refresh', {
        refreshToken: refresh,
      });
      setTokens(res.accessToken, refresh);
      toast('Session refreshed', 'success');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Refresh failed', 'error');
    } finally {
      setBusy(false);
    }
  }

  async function signOutEverywhere() {
    setBusy(true);
    try {
      await api.post('/auth/logout', { refreshToken: getRefreshToken() ?? '' });
    } catch (e) {
      // The server-side revoke failed (offline, expired token, 5xx). We still sign
      // out locally: leaving the user logged in after they asked to sign out is the
      // worse failure mode. Surface it so they know the remote session may persist.
      toast(
        e instanceof ApiError
          ? `Signed out locally, but the server session may remain: ${e.message}`
          : 'Signed out locally, but the server session may remain.',
        'error',
      );
    } finally {
      clearTokens();
      window.location.href = '/login';
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'preferences', label: 'Match Preferences' },
    { id: 'privacy', label: 'Privacy' },
    { id: 'photos', label: 'Photos' },
    { id: 'nearby', label: 'Nearby' },
    { id: 'security', label: 'Security' },
  ];

  return (
    <div>
      <div className="page-head">
        <h1>Settings</h1>
        <p>Control how you match, what others see, and your session.</p>
      </div>
      {loading ? (
        <div className="state">
          <span className="spinner" />
        </div>
      ) : (
        <>
          <div className="tabs">
            {tabs.map((t) => (
              <button key={t.id} data-active={tab === t.id} onClick={() => setTab(t.id)}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === 'preferences' && (
            <Card title="Match Preferences">
              <div className="grid2">
                <Input
                  label="Minimum age"
                  type="number"
                  value={String(prefs.ageMin)}
                  onChange={(e) => setPrefs({ ...prefs, ageMin: Number(e.currentTarget.value) })}
                />
                <Input
                  label="Maximum age"
                  type="number"
                  value={String(prefs.ageMax)}
                  onChange={(e) => setPrefs({ ...prefs, ageMax: Number(e.currentTarget.value) })}
                />
                <Input
                  label="Distance (km)"
                  type="number"
                  value={String(prefs.distanceKm)}
                  onChange={(e) =>
                    setPrefs({ ...prefs, distanceKm: Number(e.currentTarget.value) })
                  }
                />
                <Select
                  label="Minimum education"
                  value={prefs.educationMin}
                  onChange={(e) =>
                    setPrefs({ ...prefs, educationMin: e.currentTarget.value as EducationLevel })
                  }
                >
                  <option value="">Any</option>
                  {Object.values(EducationLevel).map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </Select>
              </div>
              <Input
                label="Preferred professions (comma separated)"
                value={prefs.professions}
                onChange={(e) => setPrefs({ ...prefs, professions: e.currentTarget.value })}
              />
              <Input
                label="Relationship goals (comma separated)"
                value={prefs.relationshipGoals}
                onChange={(e) => setPrefs({ ...prefs, relationshipGoals: e.currentTarget.value })}
              />
              <Button disabled={busy} onClick={savePreferences}>
                Save preferences
              </Button>
            </Card>
          )}

          {tab === 'privacy' && (
            <Card title="Privacy Controls">
              <div className="grid2">
                <label
                  className="field"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}
                >
                  <input
                    type="checkbox"
                    checked={privacy.showEmployer}
                    onChange={(e) =>
                      setPrivacy({ ...privacy, showEmployer: e.currentTarget.checked })
                    }
                  />
                  <span>Show my employer to matches</span>
                </label>
                <label
                  className="field"
                  style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem' }}
                >
                  <input
                    type="checkbox"
                    checked={privacy.showAge}
                    onChange={(e) => setPrivacy({ ...privacy, showAge: e.currentTarget.checked })}
                  />
                  <span>Show my age to matches</span>
                </label>
                <Select
                  label="Photo visibility"
                  value={privacy.photoVisibility}
                  onChange={(e) =>
                    setPrivacy({
                      ...privacy,
                      photoVisibility: e.currentTarget.value as Privacy['photoVisibility'],
                    })
                  }
                >
                  <option value="all">Everyone</option>
                  <option value="matches">My matches only</option>
                  <option value="none">No one</option>
                </Select>
              </div>
              <Button disabled={busy} onClick={savePrivacy}>
                Save privacy
              </Button>
            </Card>
          )}

          {tab === 'photos' && (
            <Card title={`Photos (${photos.length}/3)`}>
              <div
                className="row-actions"
                style={{ flexWrap: 'wrap', marginBottom: '1rem', gap: '0.75rem' }}
              >
                {photos.length === 0 && <p style={{ color: 'var(--muted)' }}>No photos yet.</p>}
                {photos.map((url, i) => (
                  <div key={url} style={{ position: 'relative' }}>
                    <img
                      src={url}
                      alt=""
                      style={{
                        width: 96,
                        height: 96,
                        objectFit: 'cover',
                        borderRadius: 12,
                        border: i === 0 ? '2px solid var(--accent)' : '1px solid var(--line)',
                      }}
                    />
                    {i === 0 && (
                      <span
                        className="badge badge-good"
                        style={{ position: 'absolute', top: 4, left: 4 }}
                      >
                        Primary
                      </span>
                    )}
                  </div>
                ))}
              </div>
              {photos.length < 3 ? (
                <FileUpload
                  label="Add a photo"
                  accept="image/*"
                  folder="photos"
                  onChange={addPhoto}
                />
              ) : (
                <p style={{ color: 'var(--muted)' }}>Maximum of 3 photos reached.</p>
              )}
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                Photos are stored encrypted at rest (AES-256-GCM) per POPIA. Your first photo is
                your primary; the grid of up to 3 is what others see on discovery cards.
              </p>
            </Card>
          )}

          {tab === 'nearby' && (
            <Card title="WeChat-Nearby">
              <p style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
                Nearby surfaces your profile to other vetted members in the{' '}
                <strong>same district</strong> who have Nearby turned on — like WeChat&apos;s
                people-nearby, but scoped to your neighbourhood. Turn it on to be discoverable.{' '}
                <strong>Browsing</strong> Nearby is a <strong>Premium</strong> feature.
              </p>
              <div className="grid2">
                <Input
                  label="District / neighbourhood"
                  value={district}
                  placeholder="e.g. Sandton, Camps Bay"
                  onChange={(e) => setDistrict(e.currentTarget.value)}
                />
                <label
                  className="field"
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: '0.5rem',
                    marginTop: '0.5rem',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={nearbyEnabled}
                    onChange={(e) => setNearbyEnabled(e.currentTarget.checked)}
                  />{' '}
                  <span>Show me in Nearby to other verified members in my district</span>
                </label>
              </div>
              <Button disabled={busy} onClick={saveNearby}>
                Save nearby settings
              </Button>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: '1rem' }}>
                Not Premium yet?{' '}
                <Link
                  href="/portal/account"
                  className="btn btn-subtle"
                  style={{ display: 'inline', padding: '0.25rem 0.5rem' }}
                >
                  Upgrade in Account
                </Link>
              </p>
            </Card>
          )}

          {tab === 'security' && (
            <Card title="Security">
              <p style={{ color: 'var(--muted)' }}>
                Signed in as <strong>{user?.email}</strong>. Authentication uses passwordless
                one-time codes.
              </p>
              <div className="row-actions">
                <Button disabled={busy} onClick={refreshSession}>
                  Refresh session token
                </Button>
                <Button variant="ghost" disabled={busy} onClick={signOutEverywhere}>
                  Sign out everywhere
                </Button>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                To delete your account and purge all personal data, contact support — or use the
                data export API under POPIA. This action is irreversible.
              </p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
