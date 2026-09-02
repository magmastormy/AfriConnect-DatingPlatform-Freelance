'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useClerkIdentity } from '@/lib/useClerkIdentity';
import { CLERK_ENABLED } from '@/lib/clerk';
import { useToast } from '@/components/Toast';
import { Button, Input } from '@/components/ui';
import { FileUpload } from '@/components/FileUpload';
import { validateRequired, sanitizeText } from '@/lib/validate';
import { MembershipStage } from '@/lib/membership';
import { SmileVerify } from '@/components/SmileVerify';

/**
 * Lightweight onboarding + verification flow.
 *
 * Step 1 — the essentials: name, date of birth, and a profile photo. Everything
 * else (work, education, bio, interests, preferences) is finished later from
 * My Profile / Settings, so signing up is instant.
 *
 * Step 2 — the identity check (ID document + selfie). This is the verification
 * "process" the member still walks through; in prototype mode it auto-approves,
 * so there is no admin queue to work.
 */
interface Essentials {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
}

const STEP_LABELS = ['About you', 'Identity check'];

export function OnboardingForm() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading, stage, refreshApplication } = useAuth();
  const { user: clerkUser, isLoaded: clerkLoaded } = useClerkIdentity();

  const [step, setStep] = useState<0 | 1>(0);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [essentials, setEssentials] = useState<Essentials>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
  });
  const [photoUrl, setPhotoUrl] = useState('');
  const [idDocumentUrl, setIdDocumentUrl] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');

  // OAuth (Google/Clerk) already supplies a photo, so the upload is optional there.
  const hasOAuthPhoto = Boolean(clerkUser?.imageUrl);

  useEffect(() => {
    if (loading) return;
    if (CLERK_ENABLED && !clerkLoaded) return;
    if (!user) {
      setChecking(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const p = await api.get<Partial<Essentials>>('/profile/me');
        if (!active) return;
        setEssentials((f) => ({
          ...f,
          firstName: p.firstName ?? '',
          lastName: p.lastName ?? '',
          dateOfBirth: p.dateOfBirth ? String(p.dateOfBirth).slice(0, 10) : '',
        }));
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          setError(err instanceof ApiError ? err.message : 'Could not load your profile');
        }
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [user, loading, clerkLoaded]);

  function set<K extends keyof Essentials>(k: K, v: Essentials[K]) {
    setEssentials((f) => ({ ...f, [k]: v }));
  }

  function validateStep1(): string | null {
    return (
      validateRequired(essentials.firstName, 'First name') ??
      validateRequired(essentials.lastName, 'Last name') ??
      validateRequired(essentials.dateOfBirth, 'Date of birth') ??
      // Photo is required only when the account has no OAuth-supplied image.
      (hasOAuthPhoto ? null : validateRequired(photoUrl, 'A profile photo'))
    );
  }

  function validateStep2(): string | null {
    return validateRequired(idDocumentUrl, 'ID document') ?? validateRequired(selfieUrl, 'Selfie');
  }

  async function submit() {
    const e1 = validateStep1();
    if (e1) {
      setError(e1);
      setStep(0);
      return;
    }
    const e2 = validateStep2();
    if (e2) {
      setError(e2);
      setStep(1);
      return;
    }
    setError(null);
    setSaving(true);
    try {
      // 1) Persist the essentials.
      await api.put('/profile/me', {
        firstName: sanitizeText(essentials.firstName),
        lastName: sanitizeText(essentials.lastName),
        dateOfBirth: essentials.dateOfBirth,
      });

      // 2) Persist the uploaded photo (skipped when OAuth already supplied one).
      if (photoUrl) {
        await api.post('/profile/me/photos', { url: photoUrl, isPrimary: true });
      }

      // 3) Submit the vetting application (ID + selfie). Prototype mode auto-approves.
      await api.post('/applications', {
        firstName: sanitizeText(essentials.firstName),
        lastName: sanitizeText(essentials.lastName),
        dateOfBirth: essentials.dateOfBirth,
        idDocumentUrl,
        selfieUrl,
      });

      await refreshApplication();
      toast('Verification submitted — you’re being verified now', 'success');
      router.push('/portal/discover');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not submit your application');
    } finally {
      setSaving(false);
    }
  }

  if (loading || checking) {
    return (
      <div className="state">
        <span className="spinner" aria-label="Loading" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="gate">
        <h2>Create your account first</h2>
        <p>Verification continues once you have an account.</p>
        <div className="gate-actions">
          <Link className="btn btn-primary" href="/sign-up">
            Create account
          </Link>
          <Link className="btn btn-ghost" href="/sign-in">
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  // Already approved — nothing to fill in.
  if (stage === MembershipStage.Verified) {
    return (
      <div className="vet">
        <div className="vet-card vet-status">
          <div className="vet-status-mark good" aria-hidden>
            Verified
          </div>
          <h1>You’re verified</h1>
          <p>
            Your application has been approved. You can connect with members, join events, and keep
            refining your profile from the account page.
          </p>
          <div className="vet-actions vet-actions-center">
            <Link className="btn btn-primary" href="/portal">
              Go to portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Application is with the vetting team — show a status card, not the form.
  if (stage === MembershipStage.PendingReview) {
    return (
      <div className="vet">
        <div className="vet-card vet-status">
          <div className="vet-status-mark warn" aria-hidden>
            …
          </div>
          <h1>Application received</h1>
          <p>
            Our team is reviewing your verification. We’ll notify you here the moment there’s a
            decision — usually within a few days. No action needed from you.
          </p>
          <div className="vet-actions vet-actions-center">
            <Link className="btn btn-primary" href="/portal">
              Back to portal
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="vet">
      <SmileVerify />
      <div className="vet-divider">
        <span>or complete the application manually</span>
      </div>
      <header className="vet-head">
        <p className="kicker">Verification</p>
        <h1>Get verified</h1>
        <p>Two short steps: your details, then a quick ID check. You can finish your full profile later from Settings.</p>
      </header>

      <div className="vet-card">
        <div className="vet-stepbar" aria-hidden>
          <span className={`vet-step ${step === 0 ? 'is-on' : ''}`} />
          <span className={`vet-step ${step === 1 ? 'is-on' : ''}`} />
        </div>
        <p className="vet-steplabel">
          Step {step + 1} of 2 — {STEP_LABELS[step]}
        </p>

        {error && <div className="notice">{error}</div>}

        {step === 0 && (
          <div>
            <section className="vet-section">
              <h2>About you</h2>
              <div className="grid2">
                <Input
                  label="First name"
                  value={essentials.firstName}
                  onChange={(e) => set('firstName', e.currentTarget.value)}
                />
                <Input
                  label="Last name"
                  value={essentials.lastName}
                  onChange={(e) => set('lastName', e.currentTarget.value)}
                />
                <Input
                  label="Date of birth"
                  type="date"
                  value={essentials.dateOfBirth}
                  onChange={(e) => set('dateOfBirth', e.currentTarget.value)}
                />
              </div>

              <div className="field">
                <span>Profile photo</span>
                {hasOAuthPhoto ? (
                  <p className="vet-hint">
                    We’ll use the photo from your sign-in account. You can add more from Settings.
                  </p>
                ) : (
                  <p className="vet-hint">A clear photo helps other members recognise you. Required to continue.</p>
                )}
                <FileUpload
                  label="Upload photo"
                  accept="image/*"
                  folder="photos"
                  value={photoUrl}
                  onChange={setPhotoUrl}
                />
              </div>
            </section>

            <div className="vet-actions">
              <Button
                onClick={() => {
                  const e = validateStep1();
                  if (e) {
                    setError(e);
                  } else {
                    setError(null);
                    setStep(1);
                  }
                }}
                disabled={saving}
              >
                Continue
              </Button>
              <Link className="btn btn-ghost" href="/portal">
                Do this later
              </Link>
            </div>
          </div>
        )}

        {step === 1 && (
          <div>
            <section className="vet-section">
              <h2>Identity check</h2>
              <FileUpload
                label="ID document"
                accept="image/*,application/pdf"
                folder="vetting"
                value={idDocumentUrl}
                onChange={setIdDocumentUrl}
              />
              <FileUpload
                label="Selfie (hold your ID)"
                accept="image/*"
                folder="vetting"
                value={selfieUrl}
                onChange={setSelfieUrl}
              />
              <p className="vet-hint">
                Images are encrypted at rest and visible only to our vetting team.
              </p>
            </section>

            <div className="vet-actions">
              <Button variant="ghost" onClick={() => setStep(0)} disabled={saving}>
                Back
              </Button>
              <Button onClick={submit} disabled={saving}>
                {saving ? 'Submitting…' : 'Submit application'}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
