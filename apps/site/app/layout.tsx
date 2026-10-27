import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/manrope';
import '@fontsource-variable/inter';
import '@nua-crew/ui/styles.css';
import './site.css';
import { AI_DISCLOSURE, BrandLockup, ButtonLink, SUPPORT_LINE, TAGLINE } from '@nua-crew/ui';
import { MainNav } from './nav';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: `NUA CREW — ${TAGLINE}`, template: '%s · NUA CREW' },
  description: `${SUPPORT_LINE} Permanent jobs and temporary work in Australia, starting with hospitality and local services in Melbourne.`,
  applicationName: 'NUA CREW',
  openGraph: {
    siteName: 'NUA CREW',
    title: `NUA CREW — ${TAGLINE}`,
    description: SUPPORT_LINE,
    type: 'website',
    locale: 'en_AU',
  },
  robots: SITE.indexable ? undefined : { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: '#3C0B21' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en-AU">
      <body>
        <a className="nua-skip" href="#main">
          Skip to content
        </a>
        <header className="site-header">
          <div className="nua-container site-header__inner" style={{ padding: '0 16px' }}>
            <BrandLockup />
            <MainNav />
            <div className="nua-row">
              <ButtonLink href={`${SITE.appUrl}/login`} variant="secondary">
                Log in
              </ButtonLink>
              <ButtonLink href="/apps">Get the app</ButtonLink>
            </div>
          </div>
        </header>
        <main id="main">{children}</main>
        <footer className="site-footer">
          <div className="nua-container" style={{ padding: '0 16px' }}>
            <div className="site-footer__grid">
              <div>
                <BrandLockup />
                <p style={{ marginTop: 16 }}>{TAGLINE}</p>
                <p>{SUPPORT_LINE}</p>
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
                    <a href="/legal">Terms and privacy policy</a>
                  </li>
                  <li>
                    <a href="/contact">Contact</a>
                  </li>
                </ul>
              </div>
              <div>
                <h2>Open the product</h2>
                <ul>
                  <li>
                    <a href={`${SITE.appUrl}/jobs`}>NUA CREW Jobs</a>
                  </li>
                  <li>
                    <a href={`${SITE.hireUrl}/login`}>NUA CREW Hire</a>
                  </li>
                </ul>
              </div>
            </div>
            <small>{AI_DISCLOSURE}</small>
            <small style={{ marginTop: 8 }}>
              NUA CREW is a working name; trade mark, business-name and domain clearance is still
              pending. Addresses on this site (such as {SITE.url.replace('https://', '')}) are
              placeholders until the real domain is provided.
            </small>
          </div>
        </footer>
      </body>
    </html>
  );
}
