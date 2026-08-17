'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, ApiError } from '@/lib/api';
import { useAuth, isAdmin } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { Card, Button, Badge, ApiState } from '@/components/ui';
import { AdminTabs } from '@/components/AdminTabs';
import type { PlatformSettingsView, UpdateSettingsInput } from '@/lib/types';

const GATED_FIELDS: { key: string; label: string; hint: string }[] = [
  { key: 'nationality', label: 'Nationality', hint: 'Country of origin' },
  { key: 'profession', label: 'Profession (exact)', hint: 'Job title / role' },
  { key: 'educationLevel', label: 'Education level', hint: 'Highest qualification' },
  { key: 'dateOfBirth', label: 'Date of birth', hint: 'Used to derive age' },
];

export default function AdminSettingsPage() {
  const { user, loading } = useAuth();
  const toast = useToast();

  const [settings, setSettings] = useState<PlatformSettingsView | null>(null);
  const [loadingView, setLoadingView] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Editable working copy.
  const [extraPhotos, setExtraPhotos] = useState(1);
  const [connectionLimit, setConnectionLimit] = useState(5);
  const [hiddenFields, setHiddenFields] = useState<string[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoadingView(true);
    setLoadError(null);
    try {
      const s = await api.getSettings();
      setSettings(s);
      setExtraPhotos(s.freeViewMaxExtraPhotos);
      setConnectionLimit(s.freePremiumConnectionLimit);
      setHiddenFields(s.restrictedHiddenFields ?? []);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : 'Failed to load settings');
    } finally {
      setLoadingView(false);
    }
  }, []);

  useEffect(() => {
    if (user && isAdmin(user.role)) void load();
  }, [user, load]);

  if (loading) {
    return (
      <div className="state">
        <span className="spinner" aria-label="Loading" />
      </div>
    );
  }
  if (!user || !isAdmin(user.role)) {
    return (
      <div className="card" style={{ maxWidth: 560, margin: '2rem auto' }}>
        <h1 style={{ marginTop: 0 }}>Admins only</h1>
        <p style={{ color: 'var(--muted)' }}>
          You need an administrator role to manage platform settings.
        </p>
      </div>
    );
  }

  const toggleField = (key: string) => {
    setSavedMsg(null);
    setHiddenFields((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key],
    );
  };

  const dirty =
    !settings ||
    settings.freeViewMaxExtraPhotos !== extraPhotos ||
    settings.freePremiumConnectionLimit !== connectionLimit ||
    JSON.stringify([...settings.restrictedHiddenFields].sort()) !==
      JSON.stringify([...hiddenFields].sort());

  async function save() {
    setSaving(true);
    setSaveError(null);
    setSavedMsg(null);
    const body: UpdateSettingsInput = {
      freeViewMaxExtraPhotos: extraPhotos,
      freePremiumConnectionLimit: connectionLimit,
      restrictedHiddenFields: hiddenFields,
    };
    try {
      const updated = await api.updateSettings(body);
      setSettings(updated);
      setExtraPhotos(updated.freeViewMaxExtraPhotos);
      setConnectionLimit(updated.freePremiumConnectionLimit);
      setHiddenFields(updated.restrictedHiddenFields);
      setSavedMsg('Settings saved.');
      toast('Settings saved', 'success');
    } catch (e) {
      setSaveError(e instanceof ApiError ? e.message : 'Failed to save settings');
      toast(e instanceof ApiError ? e.message : 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="page-head" style={{ maxWidth: 900, margin: '0 auto' }}>
      <h1>Platform settings</h1>
      <p>
        The CRM of discovery gating — how free vs premium members see each other. Changes apply
        immediately (cached for ~30s) and persist to the database.
      </p>

      <AdminTabs />

      <ApiState loading={loadingView} error={loadError}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Card title="Photo visibility (restricted viewers)">
            <p style={{ color: 'var(--muted)', marginTop: 0 }}>
              When a free+vetted member opens a premium+vetted member&apos;s card, the profile
              picture is always shown. This many <strong>additional</strong> gallery photos are
              revealed on top of it.
            </p>
            <label style={{ display: 'block', marginTop: 8 }}>
              Extra photos shown to restricted viewers
              <input
                type="number"
                min={0}
                max={10}
                value={extraPhotos}
                onChange={(e) => {
                  setSavedMsg(null);
                  setExtraPhotos(Number(e.target.value));
                }}
                style={{ marginLeft: 8, width: 72 }}
              />
            </label>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
              e.g. value 1 ⇒ profile picture + 1 extra (2 photos total in the carousel).
            </p>
          </Card>

          <Card title="Connection cap (free → premium)">
            <p style={{ color: 'var(--muted)', marginTop: 0 }}>
              A free+vetted member may hold at most this many connections with premium+vetted
              members. Unfriending frees a slot, but only upgrading to Premium removes the cap.
            </p>
            <label style={{ display: 'block', marginTop: 8 }}>
              Max premium+vetted connections per free member
              <input
                type="number"
                min={1}
                max={100}
                value={connectionLimit}
                onChange={(e) => {
                  setSavedMsg(null);
                  setConnectionLimit(Number(e.target.value));
                }}
                style={{ marginLeft: 8, width: 72 }}
              />
            </label>
          </Card>

          <Card title="Fields withheld from restricted viewers">
            <p style={{ color: 'var(--muted)', marginTop: 0 }}>
              Tick a field to <strong>hide</strong> it from free+vetted members viewing a
              premium+vetted member&apos;s card. (Industry, gender, bio, headline and location are
              always visible.)
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              {GATED_FIELDS.map((f) => (
                <label
                  key={f.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={hiddenFields.includes(f.key)}
                    onChange={() => toggleField(f.key)}
                  />
                  <span>
                    <strong>{f.label}</strong>{' '}
                    <span style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>— {f.hint}</span>
                  </span>
                  {hiddenFields.includes(f.key) && <Badge tone="warn">hidden</Badge>}
                </label>
              ))}
            </div>
          </Card>

          {saveError && <p style={{ color: 'var(--bad, #c0392b)' }}>{saveError}</p>}
          {savedMsg && <p style={{ color: 'var(--good, #27ae60)' }}>{savedMsg}</p>}

          <div style={{ display: 'flex', gap: 10 }}>
            <Button variant="primary" disabled={!dirty || saving} onClick={save}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            {dirty && (
              <Button variant="ghost" disabled={saving} onClick={load}>
                Discard
              </Button>
            )}
          </div>
        </div>
      </ApiState>
    </div>
  );
}
