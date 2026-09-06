import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import { cookies } from 'next/headers';
import './globals.css';
import { AuthProvider } from '@/lib/auth';
import { ToastProvider } from '@/components/Toast';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SiteNav } from '@/components/SiteNav';
import { SiteFooter } from '@/components/SiteFooter';
import { JsonLd } from '@/components/JsonLd';
import { ThemeProvider } from '@/lib/theme';
import { THEME_COOKIE, isThemeSetting, type ThemeSetting } from '@/lib/theme.utils';
import { ClerkProvider } from './clerk-provider';
import { BFCacheHandler } from '@/components/BFCacheHandler';
import { NotificationProvider } from '@/lib/notifications';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://africonnect.pro';

// Self-hosted fonts — no Google Fonts network (ECONNRESET at build), woff2 served from /_next/static/media with display:swap for LCP
const fraunces = localFont({
  src: [
    { path: '../../public/fonts/Fraunces-400.woff2', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Fraunces-700.woff2', weight: '700', style: 'normal' },
  ],
  variable: '--font-display',
  display: 'swap',
  preload: true,
});
const inter = localFont({
  src: '../../public/fonts/Inter-400.woff2',
  variable: '--font-sans',
  display: 'swap',
  preload: true,
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Nia — Love, with intention',
    template: '%s · Nia',
  },
  description:
    'A vetted, curated dating community for highly educated African professionals. LinkedIn-, degree- and ID-verified. Serious introductions, exclusive events, POPIA-compliant.',
  applicationName: 'Nia',
  keywords: [
    'African professionals dating',
    'vetted dating South Africa',
    'curated matchmaking professionals',
    'degree verified dating',
    'serious relationships professionals',
  ],
  authors: [{ name: 'Nia' }],
  creator: 'Nia',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'en_ZA',
    url: SITE_URL,
    siteName: 'Nia',
    title: 'Nia — Love, with intention',
    description:
      'A vetted, curated dating community for highly educated African professionals. Verified. Curated. Serious.',
    images: [
      {
        url: '/og/nia-og-card.png',
        width: 1200,
        height: 630,
        alt: 'Nia — Love, with intention',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nia — Love, with intention',
    description: 'A vetted, curated dating community for highly educated African professionals.',
  },
  robots: { index: true, follow: true },
  icons: {
    icon: '/icon.svg',
    apple: '/icons/apple-touch-icon-180.png',
  },
};

export const viewport: Viewport = {
  themeColor: '#581845',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Read the persisted theme on the server so the correct palette is present in
  // the very first HTML paint. Without this the browser renders light and then
  // snaps to dark once hydration runs.
  const cookieTheme = cookies().get(THEME_COOKIE)?.value;
  const initialTheme: ThemeSetting = isThemeSetting(cookieTheme) ? cookieTheme : 'system';

  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'Nia',
    url: SITE_URL,
    description: 'A vetted, curated dating community for highly educated African professionals.',
    areaServed: 'ZA',
    logo: `${SITE_URL}/icon.svg`,
  };
  const siteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Nia',
    url: SITE_URL,
  };

  return (
    <html
      lang="en"
      data-theme={initialTheme}
      className={`${fraunces.variable} ${inter.variable}`}
      suppressHydrationWarning
    >
      <body>
        <BFCacheHandler />
        <JsonLd data={orgLd} />
        <JsonLd data={siteLd} />
        <ThemeProvider initialTheme={initialTheme}>
          {/* AuthProvider must sit OUTSIDE ClerkProvider: the Clerk session
              bridge calls useAuth() to publish the exchanged session. */}
          <AuthProvider>
            <NotificationProvider>
              <ClerkProvider>
                <ToastProvider>
                  <ErrorBoundary>
                    <SiteNav />
                    <main className="app">{children}</main>
                    <SiteFooter />
                  </ErrorBoundary>
              </ToastProvider>
            </ClerkProvider>
            </NotificationProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
