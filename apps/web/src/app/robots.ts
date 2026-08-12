import type { MetadataRoute } from 'next';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://africonnect.pro';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/portal', '/admin', '/api'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
