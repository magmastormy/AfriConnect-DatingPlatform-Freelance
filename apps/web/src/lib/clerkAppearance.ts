'use client';

/**
 * Clerk appearance mapped onto the AfriConnect design system.
 *
 * Clerk renders inside its own style scope that our global stylesheet cannot
 * reach, so the editorial look has to be handed over explicitly. Every value
 * below reads a CSS custom property rather than a literal, which means the
 * Clerk card follows light/dark/system flips exactly like the rest of the app.
 *
 * The object is typed structurally rather than importing Clerk's `Appearance`
 * type: @clerk/types is a transitive dependency, not a declared one, so
 * importing it directly would break the typecheck on a clean install.
 * `satisfies` is deliberately avoided for the same reason — the prop is
 * accepted positionally by <SignIn appearance={...} />.
 */
export const clerkAppearance = {
  variables: {
    colorPrimary: 'var(--brand)',
    colorText: 'var(--ink)',
    colorTextSecondary: 'var(--muted)',
    colorBackground: 'var(--surface)',
    colorInputBackground: 'var(--surface-2)',
    colorInputText: 'var(--ink)',
    colorDanger: 'var(--bad)',
    colorSuccess: 'var(--good)',
    colorWarning: 'var(--warn)',
    colorNeutral: 'var(--ink)',
    fontFamily: 'var(--font-sans)',
    fontFamilyButtons: 'var(--font-sans)',
    borderRadius: '10px',
    spacingUnit: '1rem',
  },
  elements: {
    // The page already provides the framing card, so Clerk's own chrome is
    // flattened to avoid a card-inside-a-card.
    rootBox: { width: '100%' },
    cardBox: { width: '100%', boxShadow: 'none', border: 'none' },
    card: {
      background: 'transparent',
      boxShadow: 'none',
      border: 'none',
      padding: 0,
    },
    header: { display: 'none' },
    footer: {
      background: 'transparent',
      borderTop: '1px solid var(--line)',
    },
    footerActionText: { color: 'var(--muted)' },
    footerActionLink: {
      color: 'var(--brand)',
      fontWeight: 600,
      textDecoration: 'none',
    },
    formButtonPrimary: {
      background: 'var(--brand)',
      color: 'var(--on-brand)',
      textTransform: 'none',
      fontWeight: 600,
      fontSize: '0.95rem',
      boxShadow: 'none',
      '&:hover': { background: 'var(--brand-ink)' },
      '&:focus': { boxShadow: '0 0 0 3px var(--focus-ring)' },
    },
    formFieldInput: {
      background: 'var(--surface-2)',
      borderColor: 'var(--line-strong)',
      color: 'var(--ink)',
      '&:focus': {
        borderColor: 'var(--brand)',
        boxShadow: '0 0 0 3px var(--focus-ring)',
      },
    },
    formFieldLabel: { color: 'var(--muted)', fontWeight: 600 },
    identityPreview: {
      background: 'var(--surface-3)',
      borderColor: 'var(--line)',
    },
    socialButtonsBlockButton: {
      borderColor: 'var(--line-strong)',
      color: 'var(--ink)',
      '&:hover': { background: 'var(--surface-3)' },
    },
    dividerLine: { background: 'var(--line)' },
    dividerText: { color: 'var(--muted)' },
    formFieldInputShowPasswordButton: { color: 'var(--muted)' },
    otpCodeFieldInput: {
      borderColor: 'var(--line-strong)',
      color: 'var(--ink)',
      background: 'var(--surface-2)',
    },
    alertText: { color: 'var(--ink)' },
    formFieldErrorText: { color: 'var(--bad)' },
    formFieldSuccessText: { color: 'var(--good)' },
    footerPagesLink: { color: 'var(--muted)' },
  },
};
