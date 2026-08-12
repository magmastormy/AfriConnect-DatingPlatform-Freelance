import Link from 'next/link';

export const metadata = {
  title: 'A vetted community for African professionals',
  description:
    'AfriConnect Professionals is a curated, degree- and ID-verified dating community for highly educated African professionals. Serious introductions, exclusive events, POPIA-compliant.',
  alternates: { canonical: '/' },
};

export default function LandingPage() {
  return (
    <main>
      {/* COVER */}
      <section className="cover">
        <div className="cover-mast">
          <span className="kicker">AfriConnect Professionals — Field Notes</span>
          <span className="issue">
            Vol. 01 / Johannesburg · Cape Town · Nairobi · Lagos · Accra
          </span>
        </div>
        <h1 className="cover-line">
          The people worth <em>meeting</em> are already vetted.
        </h1>
        <p className="cover-dek">
          A closed community for highly educated African professionals. We verify the degree, the ID
          and the intent before a profile is seen — so the person across the table is real, and
          worth your time. Read the <Link href="/privacy">privacy note</Link>.
        </p>

        <div className="facts">
          <div className="fact">
            <span className="n">01</span>
            <span className="l">Every member verified — degree, ID, professional email.</span>
            <span className="v">100%</span>
          </div>
          <div className="fact">
            <span className="n">02</span>
            <span className="l">Daily introductions, capped — quality over volume.</span>
            <span className="v">≤ 5 / day</span>
          </div>
          <div className="fact">
            <span className="n">03</span>
            <span className="l">Personal data encrypted at rest; tokens held in memory.</span>
            <span className="v">AES-256</span>
          </div>
          <div className="fact">
            <span className="n">04</span>
            <span className="l">Built POPIA-compliant; you can export or delete anytime.</span>
            <span className="v">POPIA</span>
          </div>
        </div>
      </section>

      {/* PRINCIPLES — LEDGER */}
      <div className="section-rule">
        <span className="idx">§ 01</span>
        <h2>What we will not do.</h2>
      </div>
      <section className="ledger">
        <div className="ledger-item">
          <span className="no">i.</span>
          <div>
            <h3>No anonymous feeds.</h3>
            <p>
              No scrolls of strangers. Every profile is a person our team has verified — no catfish,
              no inflated résumés, no mystery accounts buying reach.
            </p>
          </div>
        </div>
        <div className="ledger-item">
          <span className="no">ii.</span>
          <div>
            <h3>No volume game.</h3>
            <p>
              We cap daily introductions so the product is judged on the quality of a few matches,
              not the hours you sink into it. The goal is a short list that actually fits your life.
            </p>
          </div>
        </div>
        <div className="ledger-item">
          <span className="no">iii.</span>
          <div>
            <h3>No data as the product.</h3>
            <p>
              We do not sell member data and we do not run it through third-party ad models. PII is
              encrypted at rest; logs are scrubbed of secrets.
            </p>
          </div>
        </div>
      </section>

      {/* PULL QUOTE */}
      <section className="pull">
        <blockquote>
          &ldquo;Most platforms optimise for time-on-app. We optimise for the opposite — a short
          list of people who genuinely fit your life.&rdquo;
        </blockquote>
        <cite>— Founding note, AfriConnect Professionals</cite>
      </section>

      {/* HOW IT WORKS — LEDGER */}
      <div className="section-rule">
        <span className="idx">§ 02</span>
        <h2>From application to introduction.</h2>
      </div>
      <section className="ledger">
        <div className="ledger-item">
          <span className="no">1</span>
          <div>
            <h3>Apply.</h3>
            <p>
              Submit your background. We verify your degree (or equivalent credential), a government
              ID, and a professional email domain.
            </p>
          </div>
        </div>
        <div className="ledger-item">
          <span className="no">2</span>
          <div>
            <h3>Get vetted.</h3>
            <p>
              Our vetting team reviews and approves. You become an active, visible member — not a
              row in a feed.
            </p>
          </div>
        </div>
        <div className="ledger-item">
          <span className="no">3</span>
          <div>
            <h3>Meet well.</h3>
            <p>
              Receive daily curated matches, RSVP to hosted events, and chat in a space built for
              trust — edit, recall, block, report.
            </p>
          </div>
        </div>
      </section>

      {/* MATCHING MODEL — DEFINITION LIST */}
      <div className="section-rule">
        <span className="idx">§ 03</span>
        <h2>The matching model.</h2>
      </div>
      <section className="deflist">
        <dl>
          <div className="row">
            <dt>Education & profession</dt>
            <dd>Weighted alignment on field, level, and trajectory — not just a checkbox.</dd>
          </div>
          <div className="row">
            <dt>Life-stage & goals</dt>
            <dd>Marriage-minded, building, relocating — matched on intent, not vibes.</dd>
          </div>
          <div className="row">
            <dt>Shared interests</dt>
            <dd>Surfaced explicitly so the first conversation has somewhere to start.</dd>
          </div>
          <div className="row">
            <dt>Dealbreaker-aware</dt>
            <dd>Hard mismatches subtract; we would rather show you fewer, better people.</dd>
          </div>
          <div className="row">
            <dt>Verified bonus</dt>
            <dd>Confirmed identity and education lift a score — trust is part of compatibility.</dd>
          </div>
        </dl>
      </section>

      {/* EVENTS — TABLE */}
      <div className="section-rule">
        <span className="idx">§ 04</span>
        <h2>Where it goes offline.</h2>
      </div>
      <section className="ctable">
        <table>
          <thead>
            <tr>
              <th>City</th>
              <th>Format</th>
              <th> cadence</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Johannesburg</td>
              <td>Members&apos; lounges &amp; rooftop dinners</td>
              <td>Monthly</td>
            </tr>
            <tr>
              <td>Cape Town</td>
              <td>Wine farms &amp; coastal walks</td>
              <td>Monthly</td>
            </tr>
            <tr>
              <td>Nairobi</td>
              <td>Safari brunches &amp; talks</td>
              <td>Quarterly</td>
            </tr>
            <tr>
              <td>Lagos</td>
              <td>Studio nights &amp; salons</td>
              <td>Quarterly</td>
            </tr>
            <tr>
              <td>Accra</td>
              <td>Curated mixers</td>
              <td>Quarterly</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* CTA */}
      <section style={{ padding: '0 1.5rem' }}>
        <div className="cta-ink">
          <h2>Apply to AfriConnect Professionals.</h2>
          <Link href="/apply" className="btn btn-on-ink">
            Start your application
          </Link>
        </div>
      </section>
    </main>
  );
}
