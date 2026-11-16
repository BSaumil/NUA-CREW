import type { MetadataRoute } from 'next';
import { canonicalUrl } from '@/lib/seo';
import { PAGES, SITE } from '@/lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  return SITE.indexable ? PAGES.map((path) => ({ url: canonicalUrl(path) })) : [];
}
