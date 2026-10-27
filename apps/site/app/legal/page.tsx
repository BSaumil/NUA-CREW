import type { Metadata } from 'next';
import { PageHero, Section } from '../components';

export const metadata: Metadata = {
  title: 'Terms and privacy policy',
  alternates: { canonical: '/legal' },
};

export default function Legal() {
  return (
    <>
      <PageHero
        eyebrow="Legal"
        title="Terms and privacy policy"
        lede="These documents are not published yet."
      />
      <Section>
        <p className="site-note" role="note">
          <strong>Pending legal review.</strong> The Terms of Use and Privacy Policy are being
          drafted with legal advice and will appear here before launch. Until then this site does
          not collect personal information: it has no forms, accounts, cookies or analytics.
        </p>
        <p>
          The product&apos;s privacy design is described in plain language on the{' '}
          <a href="/trust">trust &amp; privacy page</a>. That page is a summary, not a legal
          document.
        </p>
        <p>
          NUA CREW is a working name. Trade mark, business-name and domain clearance has not been
          completed, and nothing on this site claims otherwise.
        </p>
      </Section>
    </>
  );
}
