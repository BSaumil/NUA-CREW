import type { MetadataRoute } from 'next';
import { PAGES, SITE } from '@/lib/site';

// All page metadata is reviewed in this change. Update this date only with actual content changes.
const CONTENT_LAST_UPDATED = new Date('2026-11-01T00:03:00+11:00');

export default function sitemap(): MetadataRoute.Sitemap {
  return PAGES.map((path) => ({
    url: `${SITE.url}${path === '/' ? '' : path}`,
    lastModified: CONTENT_LAST_UPDATED,
  }));
}
