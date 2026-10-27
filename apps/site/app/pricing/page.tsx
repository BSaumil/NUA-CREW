import type { Metadata } from 'next';
import { Card, Cards, Faq, PageHero, PrimaryLink, Section } from '../components';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Free for job seekers in every state and territory. Employers pay A$19 for a 14-day advertisement. Nothing renews automatically.',
  alternates: { canonical: '/pricing' },
};

export default function Pricing() {
  return (
    <>
      <PageHero
        eyebrow="Pricing"
        title="Simple, and free for people looking for work."
        lede="Pay per advertisement. No subscription, no commission, no automatic renewal."
      />

      <Section>
        <p className="site-note" role="note">
          <strong>Preview only.</strong> Payments are not switched on. Nothing can be bought today,
          and these amounts are a plan, not an invoice. Tax (GST) treatment is still to be settled.
        </p>
        <Cards>
          <Card title="Job seekers">
            <p className="site-price">Free</p>
            <ul className="site-list">
              <li>Every Australian state and territory</li>
              <li>Android, iOS and the web</li>
              <li>Permanent and temporary work</li>
              <li>Never depends on an employer paying</li>
            </ul>
          </Card>
          <Card title="Advertisement">
            <p className="site-price">A$19</p>
            <p>for 14 days</p>
            <ul className="site-list">
              <li>Disclosed pay, location and arrangement</li>
              <li>Applicant pipeline and invitations</li>
              <li>Re-advertise for A$19 for another 14 days, keeping the history</li>
            </ul>
          </Card>
          <Card title="Promotion">
            <p className="site-price">A$30</p>
            <p>extra, for 5 days</p>
            <ul className="site-list">
              <li>An add-on to an advertisement, so a new ad plus a promotion is A$49</li>
              <li>Another A$30 for another 5-day campaign</li>
              <li>Always labelled as promoted</li>
            </ul>
          </Card>
        </Cards>
      </Section>

      <Section tone="alt" title="What we promise about pricing">
        <ul className="site-list">
          <li>Each purchase needs your explicit confirmation. Nothing renews on its own.</li>
          <li>
            Top-of-search placement, if we offer it, will be limited, reserved for a clearly defined
            local category and never sold without limit. It is not on sale.
          </li>
          <li>
            Paying never changes who can find work for free, and never changes a match estimate.
          </li>
          <li>No placement fees or charges on hires.</li>
        </ul>
      </Section>

      <Section title="Questions">
        <Faq
          items={[
            {
              q: 'Will job seekers ever be charged?',
              a: (
                <p>
                  There is no plan or date to charge job seekers. If that ever changes, it would be
                  announced well ahead and would not affect existing free access without notice.
                </p>
              ),
            },
            {
              q: 'Is there an employer account fee?',
              a: <p>No separate account fee is currently planned.</p>,
            },
            {
              q: 'When can I pay?',
              a: (
                <p>
                  Not yet. Billing is a foundation only and is switched off until the product and
                  tax set-up are ready.
                </p>
              ),
            },
          ]}
        />
        <p>
          <PrimaryLink href={`${SITE.hireUrl}/register`}>Register your business</PrimaryLink>
        </p>
      </Section>
    </>
  );
}
