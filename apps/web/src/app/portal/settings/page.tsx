'use client';

import { useEffect, useState } from 'react';
import { api, ApiError, getRefreshToken, setTokens, clearTokens } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { Card, Button, Input, Select } from '@/components/ui';
import { EducationLevel } from '@/lib/shared';
import { validateRequired } from '@/lib/validate';

type Tab = 'preferences' | 'privacy' | 'photos' | 'security';

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

export default function SettingsPage() {
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
  const [photoUrl, setPhotoUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
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

  async function addPhoto() {
    const err = validateRequired(photoUrl, 'Photo URL');
    if (err) {
      toast(err, 'error');
      return;
    }
    setBusy(true);
    try {
      await api.post('/profile/me/photos', { url: photoUrl, isPrimary: photos.length === 0 });
      setPhotos((p) => [...p, photoUrl]);
      setPhotoUrl('');
      toast('Photo added', 'success');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Add failed', 'error');
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

  const tabs: { id: Tab; label: string }[] = [
    { id: 'preferences', label: 'Match Preferences' },
    { id: 'privacy', label: 'Privacy' },
    { id: 'photos', label: 'Photos' },
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
              <Button disabled={busy} onClick={savePrivacy}>
                Save privacy
              </Button>
            </Card>
          )}

          {tab === 'photos' && (
            <Card title="Photos">
              <div className="row-actions" style={{ flexWrap: 'wrap', marginBottom: '1rem' }}>
                {photos.length === 0 && <p style={{ color: 'var(--muted)' }}>No photos yet.</p>}
                {photos.map((url, i) => (
                  <div key={url} className="match" style={{ width: '100%' }}>
                    <div className="avatar">{i + 1}</div>
                    <div className="meta">
                      <div>{url.slice(0, 40)}…</div>
                      {i === 0 && <span className="badge badge-good">Primary</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="row-actions">
                <Input
                  label=""
                  value={photoUrl}
                  onChange={(e) => setPhotoUrl(e.currentTarget.value)}
                  placeholder="https://… image URL"
                />
                <Button disabled={busy} onClick={addPhoto}>
                  Add photo
                </Button>
              </div>
              <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                Photos are stored encrypted at rest (AES-256-GCM) per POPIA.
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
                <Button
                  variant="ghost"
                  onClick={() =>
                    api
                      .post('/auth/logout', {
                        refreshToken: getRefreshToken() ?? '',
                      })
                      .then(() => {
                        clearTokens();
                        window.location.href = '/login';
                      })
                  }
                >
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
