import type { Metadata } from 'next';
import { Card, Cards, Faq, PageHero, PrimaryLink, Section } from '../components';
import { PricePreview } from '../price-preview';
import { SITE, toHire } from '@/lib/site';

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

      <Section title="Plan before you pay">
        <PricePreview />
      </Section>

      <Section tone="alt" title="What we promise about pricing">
        <ul className="site-list">
          <li>Each purchase needs your explicit confirmation. Nothing renews on its own.</li>
          <li>
            Planned promotion: a reserved place in the top five for a defined local category,
            subject to capacity. It is not on sale.
          </li>
          <li>
            Job seeker access stays free. Paying for an advertisement does not override anyone’s
            privacy or contact choices.
          </li>
          <li>No placement fees or charges on hires.</li>
        </ul>
      </Section>

      <Section title="Purchase conditions">
        <p>
          Billing is not live. Review the <a href="/employer-terms#billing">employer terms</a> for
          the planned service and{' '}
          <a href="/employer-terms#refunds">cancellation and refund information</a>. Final tax
          treatment and purchase conditions will be displayed before checkout.
        </p>
      </Section>
      <Section title="Questions">
        <Faq
          items={[
            {
              q: 'Will job seekers ever be charged?',
              a: (
                <p>
                  Looking for work is free across Australia. Job seeker access does not depend on a
                  NUA POS subscription or an employer buying an advertisement.
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
          <PrimaryLink href={toHire('/register')}>
            {SITE.productLive ? 'Register your business' : 'See employer launch status'}
          </PrimaryLink>
        </p>
      </Section>
    </>
  );
}
