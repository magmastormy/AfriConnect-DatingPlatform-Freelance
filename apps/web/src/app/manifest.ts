import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Nia — Love, with intention',
    short_name: 'Nia',
    description: 'A vetted, curated dating community for highly educated African professionals.',
    start_url: '/',
    display: 'standalone',
    background_color: '#581845',
    theme_color: '#581845',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icons/favicon-16.png', sizes: '16x16', type: 'image/png', purpose: 'any' },
      { src: '/icons/favicon-32.png', sizes: '32x32', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
