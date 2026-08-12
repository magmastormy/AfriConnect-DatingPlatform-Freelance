'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '@/lib/api';
import { Button, Input, Select, Textarea } from '@/components/ui';
import { Gender, City, EducationLevel, RelationshipGoal } from '@africonnect/shared';
import { validateEmail, validatePhone, validateRequired, sanitizeText } from '@/lib/validate';

type Step = 0 | 1 | 2 | 3;
const STEPS = ['Identity', 'Profession', 'Education', 'Documents'];

export default function ApplyPage() {
  const router = useRouter();
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
      setError('Please complete the required fields.');
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
      setDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Submission failed');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="card" style={{ maxWidth: 520, margin: '2rem auto', textAlign: 'center' }}>
        <h1 style={{ marginTop: 0 }}>Application received</h1>
        <p style={{ color: 'var(--muted)' }}>
          Thank you, {form.firstName}. Our vetting team will review your application and email you
          once a decision is made. You&apos;ll be able to sign in as soon as you&apos;re approved.
        </p>
        <Button onClick={() => router.push('/')}>Back to home</Button>
      </div>
    );
  }

  return (
    <div className="card" style={{ maxWidth: 720, margin: '2rem auto' }}>
      <h1 style={{ marginTop: 0 }}>Apply for Membership</h1>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem' }}>
        {STEPS.map((label, i) => (
          <div key={label} className={`badge ${i === step ? 'badge-warn' : 'badge-neutral'}`}>
            {i + 1}. {label}
          </div>
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
