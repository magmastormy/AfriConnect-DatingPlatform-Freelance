import type { Metadata, Viewport } from 'next';
import { Fraunces, Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SiteNav } from '@/components/SiteNav';
import { JsonLd } from '@/components/JsonLd';
import { ClerkProvider } from './clerk-provider';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://africonnect.pro';

const fraunces = Fraunces({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-display',
  weight: ['400', '500', '600', '700', '900'],
});

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'AfriConnect Professionals — A vetted community for African professionals',
    template: '%s · AfriConnect Professionals',
  },
  description:
    'A vetted, curated dating community for highly educated African professionals. LinkedIn-, degree- and ID-verified. Serious introductions, exclusive events, POPIA-compliant.',
  applicationName: 'AfriConnect Professionals',
  keywords: [
    'African professionals dating',
    'vetted dating South Africa',
    'curated matchmaking professionals',
    'degree verified dating',
    'serious relationships professionals',
  ],
  authors: [{ name: 'AfriConnect Professionals' }],
  creator: 'AfriConnect Professionals',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: SITE_URL,
    siteName: 'AfriConnect Professionals',
    title: 'AfriConnect Professionals — A vetted community for African professionals',
    description:
      'A vetted, curated dating community for highly educated African professionals. Verified. Curated. Serious.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AfriConnect Professionals',
    description: 'A vetted, curated dating community for highly educated African professionals.',
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: '#16130F',
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'AfriConnect Professionals',
    url: SITE_URL,
    description: 'A vetted, curated dating community for highly educated African professionals.',
    areaServed: 'ZA',
    logo: `${SITE_URL}/icon.svg`,
  };
  const siteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'AfriConnect Professionals',
    url: SITE_URL,
  };

  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <JsonLd data={orgLd} />
        <JsonLd data={siteLd} />
        <ClerkProvider>
          <AuthProvider>
            <ToastProvider>
              <ErrorBoundary>
                <SiteNav />
                <main className="app">{children}</main>
                <footer className="lp-footer">
                  <div className="lp-footer-inner">
                    <div>
                      <span className="lp-wordmark">AfriConnect</span>
                      <p className="lp-footer-tag">
                        A vetted community for highly educated African professionals.
                      </p>
                    </div>
                    <nav className="lp-footer-cols" aria-label="Footer">
                      <div>
                        <h4>Product</h4>
                        <a href="/discover">Discover</a>
                        <a href="/matches">Matches</a>
                        <a href="/events">Events</a>
                      </div>
                      <div>
                        <h4>Company</h4>
                        <a href="/contact">Contact</a>
                        <a href="/privacy">Privacy & POPIA</a>
                        <a href="/terms">Terms</a>
                      </div>
                      <div>
                        <h4>Membership</h4>
                        <a href="/apply">Apply</a>
                        <a href="/auth">Sign in</a>
                      </div>
                    </nav>
                  </div>
                  <div className="lp-footer-base">
                    <span>
                      © {new Date().getFullYear()} AfriConnect Professionals. All rights reserved.
                    </span>
                    <span>Johannesburg · Cape Town · Nairobi</span>
                  </div>
                </footer>
              </ErrorBoundary>
            </ToastProvider>
          </AuthProvider>
        </ClerkProvider>
      </body>
    </html>
  );
}
