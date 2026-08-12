import Link from 'next/link';

export const metadata = {
  title: 'Terms of Service',
  description: 'Terms of Service for AfriConnect Professionals.',
  alternates: { canonical: '/terms' },
};

export default function TermsPage() {
  return (
    <div className="prose" style={{ paddingTop: '2.5rem' }}>
      <h1>Terms of Service</h1>
      <p className="updated">Last updated: 11 August 2026</p>

      <h2>1. Acceptance of terms</h2>
      <p>
        By creating an account or using AfriConnect Professionals (&ldquo;the Service&rdquo;), you
        agree to these Terms. Membership is conditional on successful vetting and continued
        compliance with our community standards.
      </p>

      <h2>2. Eligibility and vetting</h2>
      <p>
        The Service is for adults (18+) seeking serious relationships. We verify a degree or
        equivalent professional credential, a government ID, and a professional email domain.
        Providing false information is grounds for immediate removal.
      </p>

      <h2>3. Membership and billing</h2>
      <p>
        Premium features are billed in advance and renew until cancelled. You may cancel from your
        account settings; refunds follow the plan you selected at purchase.
      </p>

      <h2>4. Acceptable use</h2>
      <p>
        You agree not to harass, deceive, or solicit outside the Service in bad faith; not to scrape
        or re-publish member data; and not to upload unlawful, infringing, or non-consensual
        content.
      </p>

      <h2>5. Privacy</h2>
      <p>
        Your data is handled per our <Link href="/privacy">Privacy &amp; POPIA policy</Link>. We
        encrypt personal information at rest and limit access to authorised staff.
      </p>

      <h2>6. Termination</h2>
      <p>
        We may suspend or terminate accounts that breach these Terms or our vetting standards, with
        or without notice where risk to members is concerned.
      </p>

      <h2>7. Disclaimers</h2>
      <p>
        The Service is provided &ldquo;as is&rdquo;. We do not guarantee matches, relationships, or
        outcomes. You are responsible for your own safety when meeting members in person.
      </p>

      <h2>8. Contact</h2>
      <p>
        Questions about these Terms? Email{' '}
        <a href="mailto:legal@africonnect.pro">legal@africonnect.pro</a>.
      </p>
    </div>
  );
}
