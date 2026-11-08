import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/manrope';
import '@fontsource-variable/inter';
import '@nua-crew/ui/styles.css';
import './site.css';
import { BrandLockup, BrandLogo, ButtonLink, SUPPORT_LINE, TAGLINE } from '@nua-crew/ui';
import { MainNav } from './nav';
import { BUSINESS } from '@/lib/business';
import { LAUNCH, SITE } from '@/lib/site';
import { SiteJsonLd } from './site-json-ld';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `NUA CREW — ${TAGLINE}`, template: '%s · NUA CREW' },
  description: `${SUPPORT_LINE} Hospitality recruitment in pre-launch testing for Australia, with New Zealand in preparation.`,
  applicationName: 'NUA CREW',
  openGraph: {
    siteName: 'NUA CREW',
    title: `NUA CREW — ${TAGLINE}`,
    description: SUPPORT_LINE,
    type: 'website',
    locale: 'en_AU',
    images: [
      {
        url: '/opengraph-image.png',
        width: 1200,
        height: 630,
        alt: `NUA CREW — ${TAGLINE}`,
      },
    ],
  },
  robots: SITE.indexable ? { index: true, follow: true } : { index: false, follow: false },
  verification: {
    google: process.env.NUA_GOOGLE_SITE_VERIFICATION || undefined,
    other: process.env.NUA_BING_SITE_VERIFICATION
      ? { 'msvalidate.01': process.env.NUA_BING_SITE_VERIFICATION }
      : undefined,
  },
};

export const viewport: Viewport = { themeColor: '#3C0B21' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU" data-theme="light">
      <body>
        <SiteJsonLd />
        <a className="nua-skip" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="nua-container site-header__inner" style={{ padding: '0 16px' }}>
            <BrandLockup />
            <MainNav entries={LAUNCH.list} />
            {LAUNCH.anyOpen ? (
              <div className="nua-row">
                <ButtonLink href="/apps#access" variant="secondary">
                  Log in
                </ButtonLink>
              </div>
            ) : null}
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer className="site-footer">
          <div className="nua-container" style={{ padding: '0 16px' }}>
            <div className="site-footer__grid">
              <div>
                <a href="/" aria-label="NUA CREW home" className="site-footer__logo">
                  <BrandLogo width={240} tile decorative />
                </a>
                <p>{SUPPORT_LINE}</p>
                <p className="parent-brand">
                  A recruitment product from <a href={BUSINESS.parentUrl}>NUA POS</a>.
                </p>
              </div>
              <div>
                <h2>Product</h2>
                <ul>
                  <li>
                    <a href="/job-seekers">For job seekers</a>
                  </li>
                  <li>
                    <a href="/employers">For employers</a>
                  </li>
                  <li>
                    <a href="/how-it-works">How it works</a>
                  </li>
                  <li>
                    <a href="/pricing">Pricing</a>
                  </li>
                  <li>
                    <a href="/markets">Australia &amp; New Zealand</a>
                  </li>
                  <li>
                    <a href="/apps">Android and iOS apps</a>
                  </li>
                </ul>
              </div>
              <div>
                <h2>Trust</h2>
                <ul>
                  <li>
                    <a href="/trust">Trust &amp; privacy</a>
                  </li>
                  <li>
                    <a href="/privacy">Privacy policy</a>
                  </li>
                  <li>
                    <a href="/terms">Terms of use</a>
                  </li>
                  <li>
                    <a href="/legal">All policies</a>
                  </li>
                  <li>
                    <a href="/contact">Contact</a>
                  </li>
                </ul>
              </div>
              <div>
                <h2>Open the product</h2>
                <ul>
                  {LAUNCH.entries.employee.open && LAUNCH.appBase ? (
                    <li>
                      <a href={`${LAUNCH.appBase}/login`}>Employee log in</a>
                    </li>
                  ) : null}
                  {(LAUNCH.entries.employer.open || LAUNCH.entries['post-job'].open) &&
                  LAUNCH.hireBase ? (
                    <li>
                      <a href={`${LAUNCH.hireBase}/login`}>Employer log in</a>
                    </li>
                  ) : null}
                  <li>
                    <a href="/features">Explore features</a>
                  </li>
                  <li>
                    <a href="/help">Help &amp; FAQs</a>
                  </li>
                  <li>
                    <a href="/apps">App status</a>
                  </li>
                </ul>
              </div>
            </div>
            <small style={{ marginTop: 8 }}>
              {BUSINESS.tradingName} · ABN {BUSINESS.abn}. NUA CREW is a product name; no separate
              registration or trade mark status is claimed.
            </small>
          </div>
        </footer>
      </body>
    </html>
  );
}
