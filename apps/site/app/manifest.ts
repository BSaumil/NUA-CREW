import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NUA CREW',
    short_name: 'NUA CREW',
    description:
      'Where Talent Meets Opportunity. Hospitality recruitment information and product previews.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F6F0E5',
    theme_color: '#6B1738',
    lang: 'en-AU',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
