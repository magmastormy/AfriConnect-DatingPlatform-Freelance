'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/Toast';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { Gender, City, EducationLevel, RelationshipGoal, ApplicationStatus } from '@/lib/shared';
import { validateEmail, validatePhone, validateRequired, sanitizeText } from '@/lib/validate';
import { MembershipStage } from '@/lib/membership';

type Step = 0 | 1 | 2 | 3;
const STEPS = ['Identity', 'Profession', 'Education', 'Documents'];

/**
 * Vetting application.
 *
 * Account-first: this form requires a signed-in account and binds the
 * application to it, so the member can track the decision from their portal.
 * Anyone arriving without a session is sent to sign-up first.
 */
export function GetVettedForm() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading, stage, applicationStatus, refreshApplication } = useAuth();

  const [step, setStep] = useState<Step>(0);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dateOfBirth: '',
    gender: '' as Gender | '',
    nationality: '',
    profession: '',
    employer: '',
    linkedInUrl: '',
    educationLevel: '' as EducationLevel | '',
    institution: '',
    relationshipGoals: '' as RelationshipGoal | '',
    city: '' as City | '',
    idDocumentUrl: '',
    degreeCertificateUrl: '',
    selfieUrl: '',
  });

  // Prefill the email from the authenticated account so the member does not
  // retype it (and so the application matches the account it belongs to).
  useEffect(() => {
    if (user?.email) setForm((f) => (f.email ? f : { ...f, email: user.email }));
  }, [user]);

  function set<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit() {
    setError(null);
    const e: Record<string, string> = {};
    const em = validateEmail(form.email);
    if (em) e.email = em;
    const ph = validatePhone(form.phone);
    if (ph) e.phone = ph;
    const fn = validateRequired(form.firstName, 'First name');
    if (fn) e.firstName = fn;
    const ln = validateRequired(form.lastName, 'Last name');
    if (ln) e.lastName = ln;
    const ct = validateRequired(form.city, 'City');
    if (ct) e.city = ct;
    const ed = validateRequired(form.educationLevel, 'Education level');
    if (ed) e.educationLevel = ed;
    if (Object.keys(e).length) {
      setError('Please complete the required fields across all four steps.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/applications', {
        firstName: sanitizeText(form.firstName),
        lastName: sanitizeText(form.lastName),
        email: sanitizeText(form.email),
        phone: sanitizeText(form.phone),
        dateOfBirth: form.dateOfBirth,
        gender: form.gender as Gender,
        nationality: sanitizeText(form.nationality),
        profession: sanitizeText(form.profession),
        employer: sanitizeText(form.employer),
        linkedInUrl: sanitizeText(form.linkedInUrl),
        educationLevel: form.educationLevel as EducationLevel,
        institution: sanitizeText(form.institution),
        relationshipGoals: form.relationshipGoals as RelationshipGoal,
        city: form.city as City,
        idDocumentUrl: sanitizeText(form.idDocumentUrl),
        degreeCertificateUrl: sanitizeText(form.degreeCertificateUrl),
        selfieUrl: sanitizeText(form.selfieUrl),
      });
      // Refresh the cached status so gates and banners update immediately.
      await refreshApplication();
      setDone(true);
      toast('Application submitted for review', 'success');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Submission failed');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="state">
        <span className="spinner" aria-label="Loading" />
      </div>
    );
  }

  // Vetting requires an account first — this is the core product rule.
  if (!user) {
    return (
      <div className="gate">
        <h2>Create your account first</h2>
        <p>
          Vetting is tied to your member account, so you can track the decision and keep refining
          your profile while we review. It takes about a minute to sign up.
        </p>
        <div className="gate-actions">
          <Link className="btn btn-primary" href="/sign-up">
            Create account
          </Link>
          <Link className="btn btn-ghost" href="/sign-in">
            I already have one
          </Link>
        </div>
      </div>
    );
  }

  if (done || stage === MembershipStage.PendingReview) {
    return (
      <div className="gate">
        <h2>Application received</h2>
        <p>
          Our vetting team is reviewing your documents and will email you once a decision is made.
          You can keep tuning your profile in the meantime — reviewers see the latest version.
        </p>
        <div className="gate-actions">
          <Link className="btn btn-primary" href="/portal/profile">
            Refine my profile
          </Link>
          <Link className="btn btn-ghost" href="/portal">
            Go to portal
          </Link>
        </div>
      </div>
    );
  }

  if (stage === MembershipStage.Verified) {
    return (
      <div className="gate">
        <h2>You are already verified</h2>
        <p>Your membership is active. Introductions, messaging and events are all unlocked.</p>
        <div className="gate-actions">
          <Button onClick={() => router.push('/portal')}>Go to portal</Button>
        </div>
      </div>
    );
  }

  const isResubmission =
    applicationStatus === ApplicationStatus.Rejected ||
    applicationStatus === ApplicationStatus.OnHold;

  return (
    <div className="card" style={{ maxWidth: 760, margin: '2rem auto' }}>
      <h1 style={{ marginTop: 0 }}>
        {isResubmission ? 'Resubmit your application' : 'Get vetted'}
      </h1>
      <p style={{ color: 'var(--muted)', marginTop: 0 }}>
        {isResubmission
          ? 'Update the details below and resubmit for another review.'
          : 'Four short steps. Everything is encrypted and reviewed by a human.'}
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
        {STEPS.map((label, i) => (
          <button
            key={label}
            type="button"
            className={`badge ${i === step ? 'badge-warn' : 'badge-neutral'}`}
            style={{ border: 'none', cursor: 'pointer' }}
            onClick={() => setStep(i as Step)}
          >
            {i + 1}. {label}
          </button>
        ))}
      </div>
      {error && <div className="notice">{error}</div>}

      {step === 0 && (
        <div className="grid2">
          <Input
            label="First name"
            value={form.firstName}
            onChange={(e) => set('firstName', e.currentTarget.value)}
          />
          <Input
            label="Last name"
            value={form.lastName}
            onChange={(e) => set('lastName', e.currentTarget.value)}
          />
          <Input
            label="Email"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.currentTarget.value)}
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => set('phone', e.currentTarget.value)}
          />
          <Input
            label="Date of birth"
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => set('dateOfBirth', e.currentTarget.value)}
          />
          <Select
            label="Gender"
            value={form.gender}
            onChange={(e) => set('gender', e.currentTarget.value as Gender)}
          >
            <option value="">Select…</option>
            {Object.values(Gender).map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </Select>
          <Input
            label="Nationality"
            value={form.nationality}
            onChange={(e) => set('nationality', e.currentTarget.value)}
          />
          <Select
            label="City"
            value={form.city}
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
      )}

      {step === 1 && (
        <div className="grid2">
          <Input
            label="Profession"
            value={form.profession}
            onChange={(e) => set('profession', e.currentTarget.value)}
          />
          <Input
            label="Employer"
            value={form.employer}
            onChange={(e) => set('employer', e.currentTarget.value)}
          />
          <Input
            label="LinkedIn URL"
            value={form.linkedInUrl}
            onChange={(e) => set('linkedInUrl', e.currentTarget.value)}
          />
          <Select
            label="Relationship goal"
            value={form.relationshipGoals}
            onChange={(e) => set('relationshipGoals', e.currentTarget.value as RelationshipGoal)}
          >
            <option value="">Select…</option>
            {Object.values(RelationshipGoal).map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </Select>
        </div>
      )}

      {step === 2 && (
        <div className="grid2">
          <Select
            label="Education level"
            value={form.educationLevel}
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
            value={form.institution}
            onChange={(e) => set('institution', e.currentTarget.value)}
          />
        </div>
      )}

      {step === 3 && (
        <div className="stack">
          <Textarea
            label="ID document URL"
            value={form.idDocumentUrl}
            onChange={(e) => set('idDocumentUrl', e.currentTarget.value)}
          />
          <Textarea
            label="Degree certificate URL"
            value={form.degreeCertificateUrl}
            onChange={(e) => set('degreeCertificateUrl', e.currentTarget.value)}
          />
          <Textarea
            label="Selfie URL"
            value={form.selfieUrl}
            onChange={(e) => set('selfieUrl', e.currentTarget.value)}
          />
          <p style={{ color: 'var(--muted)', fontSize: '0.85rem' }}>
            Documents are encrypted at rest (AES-256-GCM) and used only for verification, per POPIA.
          </p>
        </div>
      )}

      <div className="row-actions" style={{ marginTop: '1rem' }}>
        {step > 0 && (
          <Button variant="ghost" onClick={() => setStep((s) => (s - 1) as Step)}>
            Back
          </Button>
        )}
        {step < 3 ? (
          <Button onClick={() => setStep((s) => (s + 1) as Step)}>Next</Button>
        ) : (
          <Button onClick={submit} disabled={busy}>
            {busy ? 'Submitting…' : 'Submit application'}
          </Button>
        )}
      </div>
    </div>
  );
}
