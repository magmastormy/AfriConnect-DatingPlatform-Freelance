'use client';

import { useEffect, useMemo, useState } from 'react';
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

const INTERESTS = ['Travel', 'Food', 'Music', 'Fitness', 'Books', 'Art', 'Faith', 'Business', 'Nature', 'Volunteering'];
const EXPERTISE = ['Doctor', 'Lawyer', 'Engineer', 'Designer', 'Teacher', 'Developer', 'Finance', 'Healthcare', 'Marketing', 'Founder', 'Researcher', 'Other'];
const SALARY_RANGES = ['Prefer not to say', 'Under R10k', 'R10k–R25k', 'R25k–R50k', 'R50k–R100k', 'R100k+'];
const STEP_LABELS = ['Your name', 'Gender', 'Birthday', 'Interests', 'Personal details', 'Identity check'];

type ProfileDraft = {
  firstName: string;
  lastName: string;
  gender: string;
  month: string;
  year: string;
  interests: string[];
  status: string;
  expertise: string;
  school: string;
  workplace: string;
  salaryRange: string;
};

const initialDraft: ProfileDraft = {
  firstName: '', lastName: '', gender: '', month: '', year: '', interests: [],
  status: '', expertise: '', school: '', workplace: '', salaryRange: '',
};

export function OnboardingForm() {
  const router = useRouter();
  const toast = useToast();
  const { user, loading, stage, refreshApplication } = useAuth();
  const { user: clerkUser, isLoaded: clerkLoaded } = useClerkIdentity();
  const [step, setStep] = useState(0);
  const [checking, setChecking] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<ProfileDraft>(initialDraft);
  const [photoUrl, setPhotoUrl] = useState('');
  const [idDocumentUrl, setIdDocumentUrl] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');
  const hasOAuthPhoto = Boolean(clerkUser?.imageUrl);
  const totalSteps = STEP_LABELS.length;

  useEffect(() => {
    if (loading || (CLERK_ENABLED && !clerkLoaded) || !user) {
      if (!loading && !user) setChecking(false);
      return;
    }
    let active = true;
    void api.get<Record<string, unknown>>('/profile/me').then((profile) => {
      if (!active) return;
      setDraft((current) => ({
        ...current,
        firstName: String(profile.firstName ?? ''),
        lastName: String(profile.lastName ?? ''),
        gender: String(profile.gender ?? ''),
        interests: Array.isArray(profile.interests) ? profile.interests.map(String).slice(0, 5) : [],
      }));
    }).catch((err) => {
      if (!(err instanceof ApiError && err.status === 404)) setError(err instanceof ApiError ? err.message : 'Could not load your profile');
    }).finally(() => active && setChecking(false));
    return () => { active = false; };
  }, [user, loading, clerkLoaded]);

  const set = <K extends keyof ProfileDraft>(key: K, value: ProfileDraft[K]) => setDraft((current) => ({ ...current, [key]: value }));
  const dateOfBirth = useMemo(() => draft.month && draft.year ? `${draft.year}-${draft.month.padStart(2, '0')}-01` : '', [draft.month, draft.year]);

  function validateCurrent() {
    if (step === 0) return validateRequired(draft.firstName, 'First name') ?? validateRequired(draft.lastName, 'Last name');
    if (step === 1) return validateRequired(draft.gender, 'Gender');
    if (step === 2) return validateRequired(draft.month, 'Birth month') ?? validateRequired(draft.year, 'Birth year');
    if (step === 3) return draft.interests.length ? null : 'Choose at least one interest';
    if (step === 4) {
      return validateRequired(draft.status, 'Your current status') ?? validateRequired(draft.expertise, 'Area of expertise') ??
        (draft.status === 'Student' && validateRequired(draft.school, 'School')) ??
        (draft.status !== 'Student' && validateRequired(draft.workplace, 'Workplace')) ?? validateRequired(draft.salaryRange, 'Salary range');
    }
    return validateRequired(idDocumentUrl, 'ID document') ?? validateRequired(selfieUrl, 'Selfie');
  }

  function next() {
    const validation = validateCurrent();
    if (validation) return setError(validation);
    setError(null);
    if (step < totalSteps - 1) setStep((current) => current + 1);
    else void submit();
  }

  async function submit() {
    setSaving(true);
    try {
      await api.put('/profile/me', {
        firstName: sanitizeText(draft.firstName), lastName: sanitizeText(draft.lastName),
        gender: draft.gender, dateOfBirth, interests: draft.interests, profession: draft.expertise,
        institution: draft.status === 'Student' ? sanitizeText(draft.school) : undefined,
        employer: draft.status !== 'Student' ? sanitizeText(draft.workplace) : undefined,
        bio: draft.salaryRange === 'Prefer not to say' ? undefined : `Salary range: ${draft.salaryRange}`,
      });
      if (photoUrl) await api.post('/profile/me/photos', { url: photoUrl, isPrimary: true });
      await api.post('/applications', { firstName: sanitizeText(draft.firstName), lastName: sanitizeText(draft.lastName), dateOfBirth, idDocumentUrl, selfieUrl });
      await refreshApplication();
      toast('Your profile is ready for review', 'success');
      router.push('/portal/discover');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your profile');
    } finally { setSaving(false); }
  }

  if (loading || checking) return <div className="state"><span className="spinner" aria-label="Loading" /></div>;
  if (!user) return <div className="gate"><h2>Create your account first</h2><p>Start with an account, then we’ll build your profile together.</p><div className="gate-actions"><Link className="btn btn-primary" href="/sign-up">Create account</Link><Link className="btn btn-ghost" href="/sign-in">Sign in</Link></div></div>;
  if (stage === MembershipStage.Verified) return <div className="vet"><div className="vet-card vet-status"><div className="vet-status-mark good">Verified</div><h1>You’re verified</h1><p>Your profile is live. Keep refining it any time from your account page.</p><Link className="btn btn-primary" href="/portal">Go to portal</Link></div></div>;
  if (stage === MembershipStage.PendingReview) return <div className="vet"><div className="vet-card vet-status"><div className="vet-status-mark warn">In review</div><h1>Application received</h1><p>We’re reviewing your verification. You can return to your portal while you wait.</p><Link className="btn btn-primary" href="/portal">Back to portal</Link></div></div>;

  return <div className="vet">
    <SmileVerify />
    <div className="vet-divider"><span>or complete your profile manually</span></div>
    <header className="vet-head"><p className="kicker">Your profile</p><h1>Let’s make this feel like you.</h1><p>A few focused steps. You can edit or hide anything later from Profile settings.</p></header>
    <div className="vet-card">
      <div className="vet-stepbar" aria-hidden>{STEP_LABELS.map((_, index) => <span key={index} className={`vet-step ${step >= index ? 'is-on' : ''}`} />)}</div>
      <p className="vet-steplabel">Part {step + 1} of {totalSteps} — {STEP_LABELS[step]}</p>
      {error && <div className="notice">{error}</div>}
      {step === 0 && <section className="vet-section"><h2>What should we call you?</h2><div className="grid2"><Input label="First name" value={draft.firstName} onChange={(event) => set('firstName', event.currentTarget.value)} /><Input label="Last name" value={draft.lastName} onChange={(event) => set('lastName', event.currentTarget.value)} /></div><div className="field"><span>Profile photo</span><p className="vet-hint">Optional for now{hasOAuthPhoto ? ' — we’ll use your sign-in photo.' : '.'}</p><FileUpload label="Upload photo" accept="image/*" folder="photos" value={photoUrl} onChange={setPhotoUrl} /></div></section>}
      {step === 1 && <section className="vet-section"><h2>How do you identify?</h2><div className="choice-grid">{['Male', 'Female', 'Prefer not to say'].map((option) => <button type="button" key={option} className={`choice-card ${draft.gender === option ? 'is-selected' : ''}`} onClick={() => set('gender', option)}>{option}</button>)}</div></section>}
      {step === 2 && <section className="vet-section"><h2>When were you born?</h2><div className="grid2"><Input label="Month" type="number" min="1" max="12" value={draft.month} onChange={(event) => set('month', event.currentTarget.value)} /><Input label="Year" type="number" min="1940" max={new Date().getFullYear() - 18} value={draft.year} onChange={(event) => set('year', event.currentTarget.value)} /></div><p className="vet-hint">Your exact birthday stays private unless you choose to show it.</p></section>}
      {step === 3 && <section className="vet-section"><h2>What brings you joy?</h2><p className="vet-hint">Choose up to five.</p><div className="chip-grid">{INTERESTS.map((interest) => { const selected = draft.interests.includes(interest); return <button type="button" key={interest} className={`chip ${selected ? 'is-selected' : ''}`} onClick={() => set('interests', selected ? draft.interests.filter((item) => item !== interest) : draft.interests.length < 5 ? [...draft.interests, interest] : draft.interests)}>{interest}</button>; })}</div></section>}
      {step === 4 && <section className="vet-section"><h2>A little more about your world</h2><div className="field"><span>Current status</span><div className="choice-grid">{['Student', 'Employed', 'Employed student', 'Retired'].map((option) => <button type="button" key={option} className={`choice-card ${draft.status === option ? 'is-selected' : ''}`} onClick={() => set('status', option)}>{option}</button>)}</div></div><Input label="Area of expertise" list="expertise-options" value={draft.expertise} onChange={(event) => set('expertise', event.currentTarget.value)} /><datalist id="expertise-options">{EXPERTISE.map((item) => <option key={item} value={item} />)}</datalist>{draft.status === 'Student' ? <Input label="School" value={draft.school} onChange={(event) => set('school', event.currentTarget.value)} /> : <Input label="Workplace or organisation" value={draft.workplace} onChange={(event) => set('workplace', event.currentTarget.value)} />}<label className="field"><span>Salary range</span><select value={draft.salaryRange} onChange={(event) => set('salaryRange', event.currentTarget.value)}><option value="">Choose a range</option>{SALARY_RANGES.map((range) => <option key={range} value={range}>{range}</option>)}</select></label></section>}
      {step === 5 && <section className="vet-section"><h2>One last step: verify you’re real</h2><FileUpload label="ID document" accept="image/*,application/pdf" folder="vetting" value={idDocumentUrl} onChange={setIdDocumentUrl} /><FileUpload label="Selfie (hold your ID)" accept="image/*" folder="vetting" value={selfieUrl} onChange={setSelfieUrl} /><p className="vet-hint">Your verification files are encrypted and visible only to the vetting team.</p></section>}
      <div className="vet-actions">{step > 0 && <Button variant="ghost" onClick={() => { setError(null); setStep((current) => current - 1); }} disabled={saving}>Back</Button>}<Button onClick={next} disabled={saving}>{saving ? 'Saving…' : step === totalSteps - 1 ? 'Submit profile' : 'Continue'}</Button></div>
    </div>
  </div>;
}
