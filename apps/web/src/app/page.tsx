import Link from 'next/link';
import { HomeEventsPreview } from './HomeEventsPreview';

export const metadata = {
  title: 'A vetted community for African professionals',
  description:
    'AfriConnect Professionals — curated, degree- and ID-verified dating community for highly educated African professionals. Serious introductions, exclusive events, POPIA-compliant.',
  alternates: { canonical: '/' },
};

export default function LandingPage() {
  return (
    <main className="landing-v2">
      {/* ============================================================
          01 — HERO  [Brevo scale + Revolut ink-confidence]
          Left: oversized kinetic type + proof row
          Right: floating verified stack (not cards — layered dossiers)
          ============================================================ */}
      <section className="v2-hero">
        <div className="v2-hero-banner">
          <div className="v2-hero-inner">
            <div className="v2-hero-copy" style={{ position: 'relative', zIndex: 2 }}>
              <span className="v2-eyebrow">
                <i className="v2-eyebrow-dot" aria-hidden /> AfriConnect Professionals — Verified
                since 2024
              </span>
              <h1 className="v2-display">
                The people
                <br />
                worth <em>meeting</em>
                <br />
                are already
                <span className="v2-underline"> vetted.</span>
              </h1>
              <p className="v2-lede">
                No swipes. No feeds. Every member is degree, ID and intent-verified before a profile
                is seen — so the person across the table is real, and worth your time.
              </p>
              <div className="v2-hero-actions">
                <Link href="/sign-up" className="btn btn-dark v2-cta-primary">
                  Create your account <span aria-hidden>→</span>
                </Link>
                <Link href="/discover" className="btn btn-ghost v2-cta-ghost">
                  See how it works
                </Link>
                <span className="v2-micro">Free to apply · 48h vetting · POPIA compliant</span>
              </div>

              <div className="v2-proof-row">
                <div className="v2-proof">
                  <strong>100%</strong>
                  <span>
                    verified
                    <br />
                    members only
                  </span>
                </div>
                <div className="v2-proof">
                  <strong>≤5</strong>
                  <span>
                    curated
                    <br />
                    intros / day
                  </span>
                </div>
                <div className="v2-proof">
                  <strong>AES-256</strong>
                  <span>
                    encrypted
                    <br />
                    PII at rest
                  </span>
                </div>
              </div>
            </div>

            {/* Human-group illustration — passion/attraction, self-contained SVG */}
            <div className="v2-hero-figure" aria-hidden="true">
              <img src="/human-group.svg" alt="" width="520" height="480" />
            </div>
          </div>

          {/* hairline cities */}
          <div className="v2-cities">
            <span>Johannesburg</span>
            <span className="v2-cities-dot">·</span>
            <span>Cape Town</span>
            <span className="v2-cities-dot">·</span>
            <span>Nairobi</span>
            <span className="v2-cities-dot">·</span>
            <span>Lagos</span>
            <span className="v2-cities-dot">·</span>
            <span>Accra</span>
          </div>
        </div>
      </section>

      {/* ============================================================
          02 — MARQUEE  [Brevo logo wall, but professions]
          Infinite scroll of who you actually meet
          ============================================================ */}
      <section className="v2-marquee" aria-label="Trusted professions">
        <div className="v2-marquee-track">
          {[
            'Doctors',
            'Advocates',
            'Engineers',
            'Founders',
            'Academics',
            'Architects',
            'Surgeons',
            'Analysts',
            'Creatives',
          ].map((w) => (
            <span key={w} className="v2-marquee-item">
              {w} <i>·</i>
            </span>
          ))}
          {[
            'Doctors',
            'Advocates',
            'Engineers',
            'Founders',
            'Academics',
            'Architects',
            'Surgeons',
            'Analysts',
            'Creatives',
          ].map((w) => (
            <span key={w + '2'} className="v2-marquee-item" aria-hidden>
              {w} <i>·</i>
            </span>
          ))}
        </div>
        <span className="v2-marquee-cap">
          Every profile is a person we have verified — no catfish, no inflated résumés.
        </span>
      </section>

      {/* ============================================================
          03 — MANIFESTO  [Current Vehicles warmth — ink block + bone]
          NOT 3 cards. One split strip: dark manifesto vs light proof.
          ============================================================ */}
      <section className="v2-manifesto">
        <div className="v2-manifesto-grid">
          <div className="v2-manifesto-ink">
            <span className="v2-kicker v2-kicker--on-ink">§ 01 — What we will not do</span>
            <h2>
              Most apps optimise for
              <br />
              time-on-app. We
              <br />
              <em>optimise for the opposite.</em>
            </h2>
            <div className="v2-manifesto-rules">
              <div className="v2-rule">
                <span>01</span>
                <p>
                  <strong>No anonymous feeds.</strong> No scrolls of strangers. No mystery accounts
                  buying reach.
                </p>
              </div>
              <div className="v2-rule">
                <span>02</span>
                <p>
                  <strong>No volume game.</strong> ≤5 introductions a day — enough to choose well,
                  not enough to burn out.
                </p>
              </div>
              <div className="v2-rule">
                <span>03</span>
                <p>
                  <strong>No data as the product.</strong> PII encrypted, logs scrubbed, zero ad
                  resale. POPIA by design.
                </p>
              </div>
            </div>
          </div>
          <div className="v2-manifesto-bone">
            <div className="v2-stat-big">
              <span className="v2-stat-n">100%</span>
              <span className="v2-stat-l">verified — degree, ID, professional email</span>
            </div>
            <div className="v2-mini-table">
              <div>
                <dt>Review SLA</dt>
                <dd>48 hours</dd>
              </div>
              <div>
                <dt>Median match score</dt>
                <dd>87 / 100</dd>
              </div>
              <div>
                <dt>Data retention</dt>
                <dd>You can export or delete anytime</dd>
              </div>
            </div>
            <Link href="/privacy" className="v2-link-arrow">
              Read the privacy note <span>→</span>
            </Link>
          </div>
        </div>
        {/* wiggly divider like Current Vehicles */}
        <div className="v2-wiggle" aria-hidden>
          <svg
            viewBox="0 0 1200 24"
            preserveAspectRatio="none"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M0 12 Q 25 0, 50 12 T 100 12 T 150 12 T 200 12 T 250 12 T 300 12 T 350 12 T 400 12 T 450 12 T 500 12 T 550 12 T 600 12 T 650 12 T 700 12 T 750 12 T 800 12 T 850 12 T 900 12 T 950 12 T 1000 12 T 1050 12 T 1100 12 T 1150 12 T 1200 12"
              stroke="var(--line-strong)"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </section>

      {/* ============================================================
          04 — HOW IT WORKS  [timeline, not cards]
          Oversized 01 02 03 with connecting rule — horizontal on desktop
          ============================================================ */}
      <section className="v2-section">
        <div className="v2-section-head">
          <span className="v2-kicker">§ 02 — From application to introduction</span>
          <h2>Three steps. No endless states.</h2>
        </div>
        <div className="v2-timeline">
          <div className="v2-timeline-line" aria-hidden />
          <div className="v2-timeline-item">
            <span className="v2-timeline-n">01</span>
            <h3>Apply</h3>
            <p>
              Submit your background — degree, government ID, professional email. Same fields for
              everyone, same bar.
            </p>
            <span className="v2-timeline-meta">5 minutes · encrypted</span>
          </div>
          <div className="v2-timeline-item">
            <span className="v2-timeline-n">02</span>
            <h3>Get vetted</h3>
            <p>
              Our team verifies. When approved you become visible — not a row in a feed, a person
              others can meet.
            </p>
            <span className="v2-timeline-meta">48h review · human checked</span>
          </div>
          <div className="v2-timeline-item">
            <span className="v2-timeline-n">03</span>
            <h3>Meet well</h3>
            <p>
              Daily curated matches, hosted events, and a chat built for trust — edit, recall,
              block, report.
            </p>
            <span className="v2-timeline-meta">≤5 / day · capped</span>
          </div>
        </div>
      </section>

      {/* ============================================================
          05 — MATCHING MODEL  [unique bento: score visual left, ledger right]
          NOT 3 cards. Left is the instrument, right is the definition.
          ============================================================ */}
      <section className="v2-model">
        <div className="v2-model-grid">
          <div className="v2-model-visual">
            <span className="v2-kicker">§ 03 — The matching model</span>
            <div className="v2-score">
              <div className="v2-score-ring">
                <svg viewBox="0 0 120 120" aria-hidden>
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    stroke="var(--line-strong)"
                    strokeWidth="6"
                    fill="none"
                  />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    stroke="var(--brand)"
                    strokeWidth="6"
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={`${87 * 3.267} 327`}
                    transform="rotate(-90 60 60)"
                  />
                </svg>
                <div className="v2-score-n">
                  <strong>87</strong>
                  <span>/ 100</span>
                </div>
              </div>
              <p className="v2-score-cap">
                Example compatibility — weighted on education, trajectory, life-stage and verified
                trust. Never just a checkbox.
              </p>
              <div className="v2-score-bars">
                <div>
                  <span>Education & profession</span>
                  <i style={{ width: '92%' }} />
                </div>
                <div>
                  <span>Life-stage & goals</span>
                  <i style={{ width: '84%' }} />
                </div>
                <div>
                  <span>Shared interests</span>
                  <i style={{ width: '68%' }} />
                </div>
                <div>
                  <span>Verified bonus</span>
                  <i style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          </div>
          <div className="v2-model-ledger">
            <div className="v2-ledger-row">
              <dt>Education & profession</dt>
              <dd>Weighted alignment on field, level and trajectory — not a binary filter.</dd>
            </div>
            <div className="v2-ledger-row">
              <dt>Life-stage & goals</dt>
              <dd>Marriage-minded, building, relocating — matched on intent, not vibes.</dd>
            </div>
            <div className="v2-ledger-row">
              <dt>Shared interests</dt>
              <dd>Surfaced explicitly so the first conversation has somewhere to start.</dd>
            </div>
            <div className="v2-ledger-row">
              <dt>Dealbreaker-aware</dt>
              <dd>Hard mismatches subtract. We would rather show fewer, better people.</dd>
            </div>
            <div className="v2-ledger-row">
              <dt>Verified bonus</dt>
              <dd>
                Confirmed identity and education lift a score — trust is part of compatibility.
              </dd>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================
          06 — EVENTS  [table as editorial, not card grid]
          ============================================================ */}
      <section className="v2-section v2-section--tight">
        <div className="v2-section-head v2-section-head--row">
          <div>
            <span className="v2-kicker">§ 04 — Where it goes offline</span>
            <h2>Hosted rooms. Not open bars.</h2>
          </div>
          <Link href="/events" className="btn btn-ghost">
            Full calendar <span>→</span>
          </Link>
        </div>
        <div className="v2-table-wrap">
          <table className="v2-table">
            <thead>
              <tr>
                <th>City</th>
                <th>Format</th>
                <th>Cadence</th>
                <th />
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>Johannesburg</strong>
                  <span>Members’ lounges & rooftop dinners</span>
                </td>
                <td>Intimate · 40 guests</td>
                <td>Monthly</td>
                <td>
                  <span className="v2-pill">Next: 12 Dec</span>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Cape Town</strong>
                  <span>Wine farms & coastal walks</span>
                </td>
                <td>Curated · 32 guests</td>
                <td>Monthly</td>
                <td>
                  <span className="v2-pill">Next: 19 Dec</span>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Nairobi</strong>
                  <span>Safari brunches & talks</span>
                </td>
                <td>Salon · 50 guests</td>
                <td>Quarterly</td>
                <td>
                  <span className="v2-pill v2-pill--muted">Feb</span>
                </td>
              </tr>
              <tr>
                <td>
                  <strong>Lagos</strong>
                  <span>Studio nights & salons</span>
                </td>
                <td>Salon · 50 guests</td>
                <td>Quarterly</td>
                <td>
                  <span className="v2-pill v2-pill--muted">Jan</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* Live preview keeps real data — slotted into the new system */}
      <div className="v2-live-events">
        <HomeEventsPreview />
      </div>

      {/* ============================================================
          07 — PULL QUOTE  [massive serif — Revolut confidence]
          ============================================================ */}
      <section className="v2-pull">
        <div className="v2-pull-inner">
          <span className="v2-kicker">Founding note</span>
          <blockquote>
            “We would rather be judged on the quality of a short list than the hours you sink into a
            feed.”
          </blockquote>
          <cite>AfriConnect Professionals — Built for people who value their time.</cite>
        </div>
      </section>

      {/* ============================================================
          08 — FINAL CTA  [Revolut ink block — pill button, no card]
          ============================================================ */}
      <section className="v2-cta">
        <div className="v2-cta-inner">
          <div>
            <h2>
              Join the vetted
              <br />
              <em>community.</em>
            </h2>
            <p>Apply in 5 minutes. Verified in 48 hours. Capped intros from day one.</p>
          </div>
          <div className="v2-cta-actions">
            <Link href="/sign-up" className="btn v2-btn-on-ink">
              Create your account <span>→</span>
            </Link>
            <Link href="/sign-in" className="v2-cta-secondary">
              Already vetted? Sign in
            </Link>
          </div>
        </div>
        <div className="v2-cta-foot">
          <span>POPIA compliant</span>
          <span>·</span>
          <span>Encrypted at rest</span>
          <span>·</span>
          <span>You own your data</span>
        </div>
      </section>
    </main>
  );
}
