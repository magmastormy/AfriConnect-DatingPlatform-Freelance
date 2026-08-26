'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { FileUpload } from '@/components/FileUpload';
import { Gender, City, EducationLevel } from '@/lib/shared';
import {
  NATIONALITIES,
  INDUSTRIES,
  PROOF_OF_WORK_TYPES,
  PROOF_OF_WORK_HINTS,
  type ProofOfWorkType,
} from '@/lib/shared';
import { validateRequired, sanitizeText } from '@/lib/validate';
import { MembershipStage } from '@/lib/membership';
import { SmileVerify } from '@/components/SmileVerify';

/**
 * Verification flow (post-sign-up, and re-reachable at /get-vetted).
 *
 * Two calm steps:
 *   1. About you & work (professional identity + proof of work)
 *   2. Identity check (ID document + selfie upload)
 *
 * Submits the profile (upsert) and a vetting application. Members with an
 * application in review see a status card instead of the form; verified
 * members see a done card.
 */
interface Identity {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: Gender | '';
  nationality: string;
  city: City | '';
  profession: string;
  employer: string;
  educationLevel: EducationLevel | '';
  institution: string;
  bio: string;
  linkedInUrl: string;
  industries: string[];
}

const PROOF_LABELS: Record<ProofOfWorkType, string> = {
  resume: 'Résumé / CV',
  work_badge: 'Work badge',
  selfie_company: 'Workplace selfie',
  linkedin: 'LinkedIn URL',
};

const STEP_LABELS = ['About you & work', 'Identity check'];

export function OnboardingForm() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading, stage, refreshApplication } = useAuth();

  const [step, setStep] = useState<0 | 1>(0);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [identity, setIdentity] = useState<Identity>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    nationality: '',
    city: '',
    profession: '',
    employer: '',
    educationLevel: '',
    institution: '',
    bio: '',
    linkedInUrl: '',
    industries: [],
  });
  const [proofOfWorkType, setProofOfWorkType] = useState<ProofOfWorkType | ''>('');
  const [proofOfWorkUrl, setProofOfWorkUrl] = useState('');
  const [idDocumentUrl, setIdDocumentUrl] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setChecking(false);
      return;
    }
    let active = true;
    void (async () => {
      try {
        const p = await api.get<Partial<Identity>>('/profile/me');
        if (!active) return;
        setIdentity((f) => ({
          ...f,
          firstName: p.firstName ?? '',
          lastName: p.lastName ?? '',
          dateOfBirth: p.dateOfBirth ? String(p.dateOfBirth).slice(0, 10) : '',
          gender: (p.gender as Gender) ?? '',
          city: (p.city as City) ?? '',
          profession: (p.profession as string) ?? '',
          employer: (p.employer as string) ?? '',
          educationLevel: (p.educationLevel as EducationLevel) ?? '',
          institution: (p.institution as string) ?? '',
          bio: (p.bio as string) ?? '',
          industries: (p.industries as string[]) ?? [],
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
  }, [user, loading]);

  function set<K extends keyof Identity>(k: K, v: Identity[K]) {
    setIdentity((f) => ({ ...f, [k]: v }));
  }

  function toggleIndustry(industry: string) {
    setIdentity((f) => ({
      ...f,
      industries: f.industries.includes(industry)
        ? f.industries.filter((i) => i !== industry)
        : [...f.industries, industry],
    }));
  }

  function validateStep1(): string | null {
    const proofOk =
      proofOfWorkType === 'linkedin' ? identity.linkedInUrl.trim() !== '' : proofOfWorkUrl !== '';
    return (
      validateRequired(identity.firstName, 'First name') ??
      validateRequired(identity.lastName, 'Last name') ??
      validateRequired(identity.dateOfBirth, 'Date of birth') ??
      validateRequired(identity.gender, 'Gender') ??
      validateRequired(identity.nationality, 'Nationality') ??
      validateRequired(identity.city, 'City') ??
      validateRequired(identity.profession, 'Profession') ??
      validateRequired(identity.employer, 'Employer') ??
      validateRequired(identity.educationLevel, 'Education level') ??
      validateRequired(identity.institution, 'Institution') ??
      (proofOfWorkType === '' ? 'Choose a proof-of-work method' : null) ??
      (proofOk ? null : 'Provide the chosen proof of work')
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
      // 1) Persist the profile (upsert).
      await api.put('/profile/me', {
        firstName: sanitizeText(identity.firstName),
        lastName: sanitizeText(identity.lastName),
        dateOfBirth: identity.dateOfBirth,
        gender: identity.gender as Gender,
        city: identity.city as City,
        nationality: sanitizeText(identity.nationality),
        bio: sanitizeText(identity.bio),
        profession: sanitizeText(identity.profession),
        employer: sanitizeText(identity.employer),
        educationLevel: identity.educationLevel as EducationLevel,
        institution: sanitizeText(identity.institution),
        industries: identity.industries,
      });

      // 2) Submit the vetting application with the uploaded URLs.
      await api.post('/applications', {
        firstName: sanitizeText(identity.firstName),
        lastName: sanitizeText(identity.lastName),
        dateOfBirth: identity.dateOfBirth,
        gender: identity.gender as Gender,
        nationality: sanitizeText(identity.nationality),
        city: identity.city as City,
        profession: sanitizeText(identity.profession),
        employer: sanitizeText(identity.employer),
        educationLevel: identity.educationLevel as EducationLevel,
        institution: sanitizeText(identity.institution),
        linkedInUrl: identity.linkedInUrl.trim() || undefined,
        proofOfWorkType: proofOfWorkType || undefined,
        proofOfWorkUrl: proofOfWorkUrl || undefined,
        idDocumentUrl,
        selfieUrl,
      });

      await refreshApplication();
      toast('Application submitted — our team will review it shortly', 'success');
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
            ✓
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
        <p>Two short steps to join the verified community: your details, then a quick ID check.</p>
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
                  value={identity.firstName}
                  onChange={(e) => set('firstName', e.currentTarget.value)}
                />
                <Input
                  label="Last name"
                  value={identity.lastName}
                  onChange={(e) => set('lastName', e.currentTarget.value)}
                />
                <Input
                  label="Date of birth"
                  type="date"
                  value={identity.dateOfBirth}
                  onChange={(e) => set('dateOfBirth', e.currentTarget.value)}
                />
                <Select
                  label="Gender"
                  value={identity.gender}
                  onChange={(e) => set('gender', e.currentTarget.value as Gender)}
                >
                  <option value="">Select…</option>
                  {Object.values(Gender).map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
                <Select
                  label="Nationality"
                  value={identity.nationality}
                  onChange={(e) => set('nationality', e.currentTarget.value)}
                >
                  <option value="">Select…</option>
                  {NATIONALITIES.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
                <Select
                  label="City"
                  value={identity.city}
                  onChange={(e) => set('city', e.currentTarget.value as City)}
                >
                  <option value="">Select…</option>
                  {Object.values(City).map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </Select>
              </div>
            </section>

            <section className="vet-section">
              <h2>Work &amp; education</h2>
              <div className="grid2">
                <Input
                  label="Profession"
                  value={identity.profession}
                  onChange={(e) => set('profession', e.currentTarget.value)}
                />
                <Input
                  label="Employer"
                  value={identity.employer}
                  onChange={(e) => set('employer', e.currentTarget.value)}
                />
                <Select
                  label="Education level"
                  value={identity.educationLevel}
                  onChange={(e) => set('educationLevel', e.currentTarget.value as EducationLevel)}
                >
                  <option value="">Select…</option>
                  {Object.values(EducationLevel).map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </Select>
                <Input
                  label="Institution"
                  value={identity.institution}
                  onChange={(e) => set('institution', e.currentTarget.value)}
                />
              </div>

              <div className="field">
                <span>
                  Industries{identity.industries.length > 0 && ` (${identity.industries.length})`}
                </span>
                <div className="vet-chip-grid">
                  {INDUSTRIES.map((industry) => {
                    const checked = identity.industries.includes(industry);
                    return (
                      <button
                        key={industry}
                        type="button"
                        className={`vet-chip ${checked ? 'is-on' : ''}`}
                        aria-pressed={checked}
                        onClick={() => toggleIndustry(industry)}
                      >
                        {industry}
                      </button>
                    );
                  })}
                </div>
              </div>

              <Textarea
                label="Short bio"
                value={identity.bio}
                onChange={(e) => set('bio', e.currentTarget.value)}
                placeholder="What you do, what you care about, what you are looking for."
              />
            </section>

            <section className="vet-section">
              <h2>Proof of work</h2>
              <p className="vet-hint">
                Choose how you’ll prove your professional identity. One method is required.
              </p>
              <div className="vet-chip-grid" style={{ marginTop: 12 }}>
                {PROOF_OF_WORK_TYPES.map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`vet-chip ${proofOfWorkType === type ? 'is-on' : ''}`}
                    aria-pressed={proofOfWorkType === type}
                    onClick={() => {
                      setProofOfWorkType(type);
                      // Switching method clears the previously supplied artifact.
                      setProofOfWorkUrl('');
                    }}
                  >
                    {PROOF_LABELS[type]}
                  </button>
                ))}
              </div>
              {proofOfWorkType && (
                <div style={{ marginTop: 14 }}>
                  <p className="vet-hint">{PROOF_OF_WORK_HINTS[proofOfWorkType]}</p>
                  {proofOfWorkType === 'linkedin' ? (
                    <Input
                      label="LinkedIn URL"
                      value={identity.linkedInUrl}
                      onChange={(e) => set('linkedInUrl', e.currentTarget.value)}
                      placeholder="https://linkedin.com/in/…"
                    />
                  ) : (
                    <FileUpload
                      label="Upload proof"
                      accept="image/*,application/pdf"
                      folder="proof"
                      value={proofOfWorkUrl}
                      onChange={setProofOfWorkUrl}
                    />
                  )}
                </div>
              )}
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
