import React from 'react';
import Link from 'next/link';

/**
 * Shared editorial framing for the authentication pages.
 *
 * Both sign-in and sign-up sit inside the same two-column layout: a narrative
 * column on the left that carries the vetting promise, and the credential form
 * on the right. The layout is a server component — only the Clerk widget itself
 * needs to be client-side.
 */
export function AuthShell({
  eyebrow,
  title,
  lede,
  aside,
  children,
}: {
  eyebrow: string;
  title: React.ReactNode;
  lede: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="auth-shell">
      <div className="auth-narrative">
        <span className="hero-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="hero-lede">{lede}</p>
        {aside}
      </div>
      <div className="auth-panel">
        {children}
        <p className="auth-fineprint">
          By continuing you agree to our <Link href="/terms">Terms</Link> and{' '}
          <Link href="/privacy">Privacy &amp; POPIA notice</Link>.
        </p>
      </div>
    </section>
  );
}

/** The three-step ledger shown beside the sign-up form. */
export function VettingLedger({ activeStep }: { activeStep: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Create your account', note: 'Email or a social provider. Takes a minute.' },
    { n: 2, label: 'Build your profile', note: 'Photos, profession, what you are looking for.' },
    { n: 3, label: 'Get vetted', note: 'ID, degree and LinkedIn checked by a human.' },
  ];
  return (
    <ol className="auth-ledger" aria-label="How joining works">
      {steps.map((s) => (
        <li
          key={s.n}
          className={s.n === activeStep ? 'is-active' : s.n < activeStep ? 'is-done' : ''}
        >
          <span className="auth-ledger-n">{String(s.n).padStart(2, '0')}</span>
          <span>
            <strong>{s.label}</strong>
            <em>{s.note}</em>
          </span>
        </li>
      ))}
    </ol>
  );
}
