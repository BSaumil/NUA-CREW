import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/site';

// Crawlers are asked to stay away until NUA_SITE_INDEXABLE=true is set.
export default function robots(): MetadataRoute.Robots {
  return SITE.indexable
    ? { rules: { userAgent: '*', allow: '/' }, sitemap: `${SITE.url}/sitemap.xml` }
    : { rules: { userAgent: '*', disallow: '/' } };
}
