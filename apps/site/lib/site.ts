/**
 * Placeholder addresses. `.example` is reserved (RFC 2606) and can never resolve, so nothing here
 * claims a real domain, handle or trademark. When the owner provides the real domain, set these
 * environment variables (no code change): NUA_SITE_URL, NUA_APP_URL, NUA_HIRE_URL, NUA_CONTACT_EMAIL.
 * Keep NUA_SITE_INDEXABLE unset until the real domain is live, so search engines skip the placeholder.
 */
const env = (k: string, fallback: string) => process.env[k]?.replace(/\/$/, '') || fallback;

export const SITE = {
  name: 'NUA CREW',
  url: env('NUA_SITE_URL', 'https://nua-crew.example'),
  appUrl: env('NUA_APP_URL', 'https://app.nua-crew.example'),
  hireUrl: env('NUA_HIRE_URL', 'https://hire.nua-crew.example'),
  contactEmail: env('NUA_CONTACT_EMAIL', 'hello@nua-crew.example'),
  indexable: process.env.NUA_SITE_INDEXABLE === 'true',
  isPlaceholderDomain: !process.env.NUA_SITE_URL,
} as const;

export const NAV = [
  { href: '/job-seekers', label: 'Job seekers' },
  { href: '/employers', label: 'Employers' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/trust', label: 'Trust & privacy' },
] as const;

export const PAGES = [
  '/',
  '/job-seekers',
  '/employers',
  '/how-it-works',
  '/pricing',
  '/trust',
  '/apps',
  '/contact',
  '/legal',
] as const;
