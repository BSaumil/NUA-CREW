import { buildMetadata } from '@/lib/seo';
import { Card, Cards, PageHero, Section } from '../components';
import { BUSINESS } from '@/lib/business';
export const metadata = buildMetadata('/legal');
export default function Legal() {
  return (
    <>
      <PageHero
        eyebrow="LEGAL & BUSINESS DETAILS"
        title="Clear policies. A real point of contact."
        lede="NUA CREW is a recruitment product in the NUA POS family."
      />
      <Section title="Who you are dealing with">
        <div className="business-panel">
          <div>
            <p className="section-kicker">OPERATOR</p>
            <h3>{BUSINESS.tradingName}</h3>
            <p>ABN {BUSINESS.abn}</p>
          </div>
          <div>
            <p>{BUSINESS.address}</p>
            <p>
              <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
            </p>
            <a href={BUSINESS.registerUrl}>Check the public ABN record →</a>
          </div>
        </div>
        <p className="demo-caption">
          The registered entity is an individual / sole trader. NUA CREW is a product name; no
          separate company, business-name or trade mark registration is claimed.
        </p>
      </Section>
      <Section
        tone="alt"
        title="Find the policy you need"
        intro={`Effective and last updated ${BUSINESS.updated}.`}
      >
        <Cards>
          {(
            [
              [
                '/privacy',
                'Privacy policy',
                'What information is collected, how it is used, sharing choices and complaints.',
              ],
              [
                '/terms',
                'Terms of use',
                'Ground rules, service limits, your content and consumer rights.',
              ],
              [
                '/employer-terms',
                'Employer terms',
                'Business responsibilities, applicant information and planned advertising.',
              ],
              [
                '/community-guidelines',
                'Community guidelines',
                'Respect, honest opportunities, safe conversations and reporting.',
              ],
              [
                '/cookies',
                'Cookies & website data',
                'Technical requests, interactive previews and browser controls.',
              ],
              [
                '/contact',
                'Contact & support',
                'General enquiries, privacy requests, safety concerns and business details.',
              ],
            ] as const
          ).map(([href, title, body]) => (
            <Card title={title} key={href}>
              <p>{body}</p>
              <a className="text-link" href={href}>
                Read {title.toLowerCase()} →
              </a>
            </Card>
          ))}
        </Cards>
      </Section>
      <Section title="Website live. Product in testing.">
        <p className="site-intro">
          These policies cover the public website and explain how enabled services are handled.
          Public accounts, document uploads, employer payments and app-store downloads remain
          closed. Launch-specific service providers and purchase conditions will be confirmed before
          those features open.
        </p>
        <a className="text-link" href="/apps">
          Check app and web status →
        </a>
      </Section>
    </>
  );
}
