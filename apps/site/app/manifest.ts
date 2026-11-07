import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'NUA CREW',
    short_name: 'NUA CREW',
    description: 'Hospitality recruitment information and product previews.',
    start_url: '/',
    display: 'standalone',
    background_color: '#F7F3EF',
    theme_color: '#3C0B21',
    lang: 'en-AU',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
