import Link from 'next/link';

export const metadata = {
  title: 'Privacy & POPIA Policy',
  description:
    'How AfriConnect Professionals collects, protects, and shares your data — built POPIA-compliant by design.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <div className="prose" style={{ paddingTop: '2.5rem' }}>
      <h1>Privacy &amp; POPIA</h1>
      <p className="updated">Last updated: 11 August 2026</p>

      <p>
        AfriConnect Professionals is built privacy-first. This policy explains what we collect, why,
        and the controls you have — in plain language, aligned with the Protection of Personal
        Information Act (POPIA) and global good practice.
      </p>

      <h2>What we collect</h2>
      <p>
        Identity and education evidence used for vetting (degree, ID, professional email), profile
        details you choose to share, and operational data such as login and message metadata. We do
        not collect more than vetting and matching require.
      </p>

      <h2>How we protect it</h2>
      <p>
        Personal information is encrypted at rest with AES-256-GCM. Authentication tokens are held
        in memory rather than browser storage, reducing theft risk. Our logs are scrubbed of secrets
        and PII.
      </p>

      <h2>How we use it</h2>
      <p>
        To verify members, compute compatibility, operate messaging, and meet legal obligations. We
        do not sell your data, and we do not use it for unrelated advertising.
      </p>

      <h2>Your rights</h2>
      <p>
        You can review and edit your profile, pause visibility, export your data, and request
        deletion from your <Link href="/portal/settings">account settings</Link>. You may object to
        or restrict processing where the law allows.
      </p>

      <h2>Sharing</h2>
      <p>
        We share data only with service providers needed to run the Service (e.g. hosting, payments,
        messaging) under contract, or where required by law. Matches see only what you choose to
        show.
      </p>

      <h2>Contact</h2>
      <p>
        Our information officer can be reached at{' '}
        <a href="mailto:privacy@africonnect.pro">privacy@africonnect.pro</a>.
      </p>
    </div>
  );
}
