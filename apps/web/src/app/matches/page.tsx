import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Matches',
  description: 'Your mutual matches on AfriConnect Professionals.',
};

/**
 * Public Matches landing. Mutual matches are private to the two members
 * involved, so the public page is a gate that routes to sign-up / sign-in.
 */
export default function MatchesLandingPage() {
  return (
    <section className="page">
      <header className="page-head">
        <h1>Matches</h1>
        <p className="page-lede">
          When two members both express interest, the match is revealed and you can message. No
          public browse list — by design.
        </p>
      </header>

      <div className="gate">
        <h2>Your matches are private</h2>
        <p>Sign in to see the people who have matched with you.</p>
        <div className="gate-actions">
          <Link className="btn btn-primary" href="/sign-in">
            Sign in
          </Link>
          <Link className="btn btn-ghost" href="/sign-up">
            Create account
          </Link>
        </div>
      </div>
    </section>
  );
}
