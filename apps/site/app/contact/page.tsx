import type { Metadata } from 'next';
import { PageHero, Section } from '../components';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Contact',
  description: 'How to contact NUA CREW.',
  alternates: { canonical: '/contact' },
};

export default function Contact() {
  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to us."
        lede="Questions, feedback, safety concerns or press."
      />
      <Section>
        <div className="site-cards">
          <article className="site-card">
            <h3>Email</h3>
            <p>
              <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>
            </p>
            <p className="nua-hint">
              This is a placeholder address until the real domain is provided, so it cannot receive
              mail yet.
            </p>
          </article>
          <article className="site-card">
            <h3>Safety concerns</h3>
            <p>
              Use <strong>Report</strong> inside a conversation in the app so the message is
              attached. Please do not send passwords, bank details or tax file numbers to anyone.
            </p>
          </article>
          <article className="site-card">
            <h3>Employers</h3>
            <p>
              Include your business name and ABN so we can find your account. We never ask for your
              password.
            </p>
          </article>
        </div>
      </Section>
    </>
  );
}
