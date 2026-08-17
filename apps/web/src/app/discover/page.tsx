import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Discover',
  description: 'Curated introductions for highly educated African professionals.',
};

/**
 * Public Discover landing. The actual discovery feed is members-only (it
 * reveals other people), so the public page explains the product and routes
 * signed-out visitors to sign-up and members to the portal feed.
 */
export default function DiscoverLandingPage() {
  return (
    <section className="page">
      <header className="page-head">
        <h1>Discover</h1>
        <p className="page-lede">
          A small, daily set of curated introductions — scored on education, profession, interests
          and intent, then capped so quality beats volume. Only verified members see the feed.
        </p>
      </header>

      <div className="gate">
        <h2>The feed is members-only</h2>
        <p>
          To protect members&apos; privacy, profiles only become visible after both sides are
          vetted. Create an account and get verified to start discovering.
        </p>
        <div className="gate-actions">
          <Link className="btn btn-primary" href="/sign-up">
            Create account
          </Link>
          <Link className="btn btn-ghost" href="/sign-in">
            Sign in
          </Link>
        </div>
      </div>
    </section>
  );
}
