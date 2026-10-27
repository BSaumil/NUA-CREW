import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

// While the address is a placeholder, ask crawlers to stay away.
export default function robots(): MetadataRoute.Robots {
  return SITE.indexable
    ? { rules: { userAgent: '*', allow: '/' }, sitemap: `${SITE.url}/sitemap.xml` }
    : { rules: { userAgent: '*', disallow: '/' } };
}
