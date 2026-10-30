/**
 * Addresses come from the environment so the same build works on a preview URL and on the real
 * domain. Defaults are the owner's domain, iksaa.com.au, with `app.` (NUA CREW Jobs) and `hire.`
 * (NUA CREW Hire) subdomains. Nothing here claims the name, domain or trade mark is cleared.
 *
 * - NUA_PRODUCT_LIVE=true   link "Log in / Find work / Register" to the app hosts. Until the
 *                           product apps are deployed those links go to /apps instead of a dead host.
 * - NUA_CONTACT_EMAIL       published contact address. Defaults to the verified public NUA POS
 *                           support mailbox used by this product family.
 * - NUA_SITE_INDEXABLE=true allow search engines. Unset = noindex.
 */
const env = (k: string, fallback: string) => process.env[k]?.replace(/\/$/, '') || fallback;

export const SITE = {
  name: 'NUA CREW',
  url: env('NUA_SITE_URL', 'https://iksaa.com.au'),
  appUrl: env('NUA_APP_URL', 'https://app.iksaa.com.au'),
  hireUrl: env('NUA_HIRE_URL', 'https://hire.iksaa.com.au'),
  contactEmail: process.env.NUA_CONTACT_EMAIL || 'info@nuapos.com.au',
  productLive: process.env.NUA_PRODUCT_LIVE === 'true',
  indexable: process.env.NUA_SITE_INDEXABLE === 'true',
} as const;

/** Where a call to action goes: the real app when it is live, otherwise the honest status page. */
export const toApp = (path: string) =>
  SITE.productLive ? `${SITE.appUrl}${path}` : '/apps#job-seekers';
export const toHire = (path: string) =>
  SITE.productLive ? `${SITE.hireUrl}${path}` : '/apps#employers';

export const NAV = [
  { href: '/job-seekers', label: 'Job seekers' },
  { href: '/employers', label: 'Employers' },
  { href: '/features', label: 'Features' },
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
  '/features',
  '/help',
  '/privacy',
  '/terms',
  '/employer-terms',
  '/community-guidelines',
  '/cookies',
] as const;
