import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'AfriConnect Professionals',
    short_name: 'AfriConnect',
    description: 'A vetted, curated dating community for highly educated African professionals.',
    start_url: '/',
    display: 'standalone',
    background_color: '#16130F',
    theme_color: '#16130F',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
  };
}
