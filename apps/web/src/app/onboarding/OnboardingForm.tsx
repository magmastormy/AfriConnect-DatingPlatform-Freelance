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

/**
 * Post-sign-up onboarding, repurposed into a 2-step vetting flow (Change B):
 *   1. Professional identity (+ LinkedIn URL OR proof-of-work upload)
 *   2. Identity verification (ID document + selfie upload)
 * Submits the profile (upsert) and a vetting application.
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
      router.push('/portal');
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
        <p>Onboarding continues once you have an account.</p>
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

  if (stage === MembershipStage.Verified) {
    return (
      <div className="card" style={{ maxWidth: 760, margin: '2rem auto' }}>
        <h1 style={{ marginTop: 0 }}>You are already verified</h1>
        <p style={{ color: 'var(--muted)' }}>
          Your profile is complete and your application has been approved. You can keep refining
          your profile from the account page.
        </p>
        <div className="row-actions" style={{ marginTop: '1rem' }}>
          <Link className="btn btn-primary" href="/portal">
            Go to portal
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 760, margin: '2rem auto' }}>
      <h1 style={{ marginTop: 0 }}>Get verified</h1>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        Two quick steps: tell us about your professional self, then verify your identity.
      </p>

      <div className="tabs" style={{ marginBottom: '1rem' }}>
        <button data-active={step === 0} onClick={() => setStep(0)}>
          1 · Professional identity
        </button>
        <button data-active={step === 1} onClick={() => setStep(1)}>
          2 · Verification
        </button>
      </div>

      {error && <div className="notice">{error}</div>}

      {step === 0 && (
        <div>
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

          {/* Industry — multi-select tickboxes */}
          <div className="field" style={{ marginTop: 4 }}>
            <span>
              Industry{' '}
              {identity.industries.length > 0 && `(${identity.industries.length} selected)`}
            </span>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: 8,
                marginTop: 8,
              }}
            >
              {INDUSTRIES.map((industry) => {
                const checked = identity.industries.includes(industry);
                return (
                  <label
                    key={industry}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '8px 10px',
                      border: `1px solid ${checked ? 'var(--accent)' : 'var(--line)'}`,
                      borderRadius: 10,
                      background: checked ? 'var(--accent-soft)' : 'var(--surface)',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleIndustry(industry)}
                    />
                    {industry}
                  </label>
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

          {/* Proof of work — pick a method, then supply the matching artifact */}
          <div className="field" style={{ marginTop: 4 }}>
            <span>Proof of work</span>
            <p style={{ color: 'var(--muted)', fontSize: '0.85rem', marginTop: 4 }}>
              Choose how you&apos;ll prove your professional identity. One method is required.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {PROOF_OF_WORK_TYPES.map((type) => {
                const active = proofOfWorkType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    className={active ? 'btn btn-primary' : 'btn btn-ghost'}
                    onClick={() => {
                      setProofOfWorkType(type);
                      // Switching method clears the previously supplied artifact.
                      setProofOfWorkUrl('');
                    }}
                  >
                    {PROOF_LABELS[type]}
                  </button>
                );
              })}
            </div>
            {proofOfWorkType && (
              <div style={{ marginTop: 12 }}>
                <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
                  {PROOF_OF_WORK_HINTS[proofOfWorkType]}
                </p>
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
          </div>

          <div className="row-actions" style={{ marginTop: '1rem' }}>
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
          </div>
        </div>
      )}

      {step === 1 && (
        <div>
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
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Images are encrypted at rest and visible only to our vetting team.
          </p>
          <div className="row-actions" style={{ marginTop: '1rem' }}>
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
  );
}
