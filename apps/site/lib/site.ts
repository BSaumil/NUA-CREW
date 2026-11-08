/**
 * Addresses come from the environment so the same build works on a preview URL and on the real
 * domain. Defaults are the owner's domain, iksaa.com.au, with `app.` (NUA CREW Jobs) and `hire.`
 * (NUA CREW Hire) subdomains. Nothing here claims the name, domain or trade mark is cleared.
 *
 * - NUA_PRODUCT_LIVE is a legacy marketing flag, NOT an authorisation to open
 *   registration, job posting or login. Use the independent LAUNCH readiness gates below.
 * - NUA_CONTACT_EMAIL       published contact address. Defaults to the verified public NUA POS
 *                           support mailbox used by this product family.
 * - NUA_SITE_INDEXABLE=true allow search engines. Unset = noindex.
 */
import { readLaunch } from '@nua-crew/ui';

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

/**
 * The three first-class entry points (Create Free Employee Account, Register Your Business, Post a
 * Job). Each opens on its own flag AND a valid host; otherwise it goes to the honest /apps status
 * page. A marketing flag such as NUA_PRODUCT_LIVE never opens them. See packages/ui/src/launch.ts.
 */
export const LAUNCH = readLaunch(process.env);

/** Legacy helpers must also respect granular launch gates; the older product flag is not authority. */
export const toApp = (path: string) =>
  LAUNCH.entries.employee.open && LAUNCH.appBase ? `${LAUNCH.appBase}${path}` : '/apps#job-seekers';
export const toHire = (path: string) => {
  const posting = path.startsWith('/jobs');
  const entry = posting ? LAUNCH.entries['post-job'] : LAUNCH.entries.employer;
  return entry.open && LAUNCH.hireBase
    ? `${LAUNCH.hireBase}${path}`
    : posting
      ? '/apps#post-a-job'
      : '/apps#employers';
};

/** Main menu, in the order a visitor reads it: who it is for, how it works, what it costs, where, trust. */
export const NAV = [
  { href: '/job-seekers', label: 'Job seekers' },
  { href: '/employers', label: 'Employers' },
  { href: '/how-it-works', label: 'How it works' },
  { href: '/features', label: 'Features' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/markets', label: 'Countries' },
  { href: '/trust', label: 'Trust & privacy' },
] as const;

export const PAGES = [
  '/',
  '/job-seekers',
  '/employers',
  '/how-it-works',
  '/markets',
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
