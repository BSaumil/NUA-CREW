import type { Metadata } from 'next';
import { Mail, MapPin, ShieldCheck } from 'lucide-react';
import { Card, Cards, PageHero, Section } from '../components';
import { BUSINESS } from '@/lib/business';
export const metadata: Metadata = {
  title: 'Contact',
  description: 'Contact NUA CREW, part of NUA POS, for support, privacy and employer enquiries.',
  alternates: { canonical: '/contact' },
};
export default function Contact() {
  return (
    <>
      <PageHero
        eyebrow="NUA CREW · PART OF NUA POS"
        title="Talk to a real person."
        lede="Questions about work, hiring, privacy or the upcoming launch? Start here."
      />
      <Section title="Choose the right starting point">
        <Cards>
          <Card title="General and employer enquiries">
            <Mail size={28} aria-hidden="true" />
            <p>
              <a href={`mailto:${BUSINESS.email}?subject=NUA%20CREW%20enquiry`}>{BUSINESS.email}</a>
            </p>
            <p>
              Put “NUA CREW” in the subject. Include a business name or job reference if relevant.
              We never need your password.
            </p>
          </Card>
          <Card title="Privacy and safety">
            <ShieldCheck size={28} aria-hidden="true" />
            <p>
              Use the same email with “NUA CREW Privacy” or “NUA CREW Safety” in the subject.
              Describe the concern without sending unnecessary identity documents.
            </p>
            <a className="text-link" href="/privacy#complaints">
              Privacy requests and complaints →
            </a>
          </Card>
          <Card title="Business correspondence">
            <MapPin size={28} aria-hidden="true" />
            <p>
              {BUSINESS.tradingName}
              <br />
              ABN {BUSINESS.abn}
            </p>
            <p>{BUSINESS.address}</p>
            <p>Postal contact; visits by arrangement.</p>
          </Card>
        </Cards>
        <p className="demo-caption">
          Support is not an emergency service. If anyone is in immediate danger in Australia, call
          000.
        </p>
      </Section>
      <Section tone="alt" title="An answer might be one tap away">
        <div className="site-cta-row">
          <a className="nua-button" href="/help">
            Help &amp; quick answers
          </a>
          <a className="nua-button nua-button--secondary" href="/apps">
            Check launch status
          </a>
        </div>
        <p style={{ marginTop: 20 }}>
          If you email us, we use the details you provide to respond and manage the enquiry. See our{' '}
          <a href="/privacy">privacy policy</a>. Please do not email resumes or certificates for
          storage; public document uploads are not open yet.
        </p>
      </Section>
    </>
  );
}
