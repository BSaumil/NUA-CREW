import { buildMetadata } from '@/lib/seo';
import { MARKETS } from '@/lib/markets';
import { Card, Cards, PageHero, Section } from '../components';

export const metadata = buildMetadata('/markets');

export default function Markets() {
  return (
    <>
      <PageHero
        eyebrow="WHERE WE ARE HEADED"
        title="One platform. Built for local work."
        lede="NUA CREW is preparing for Australia and New Zealand, starting with hospitality. The website is open for information; hiring accounts, job advertising and shifts are not yet available to the public."
      />
      <Section
        title="Australia and New Zealand"
        intro="Local currency, employment rules and business verification matter. Each market will be switched on only after its launch checks are complete."
      >
        <Cards>
          {Object.values(MARKETS).map((market) => (
            <Card key={market.code} title={market.label}>
              <p className="section-kicker">
                {market.stage === 'prelaunch' ? 'Pre-launch testing' : 'Preparing for launch'}
              </p>
              <p>
                {market.code === 'AU'
                  ? 'Starting with Australian hospitality. Roles and pay guidance will follow applicable Australian employment instruments.'
                  : 'New Zealand is being prepared as a separate market, with NZD pay and New Zealand-specific employment requirements.'}
              </p>
              <p>
                <strong>Currency:</strong> {market.currency} · <strong>Region:</strong>{' '}
                {market.regionLabel}
              </p>
              <p>
                <strong>Hiring services:</strong> Not publicly available yet
              </p>
              <p>
                <a href="/apps">Check product launch status</a>
              </p>
            </Card>
          ))}
        </Cards>
      </Section>
      <Section
        tone="alt"
        title="Designed to grow responsibly"
        intro="More countries may follow after local validation. No country is automatically enabled just because it appears on this page."
      >
        <Cards>
          <Card title="Country-specific pay">
            <p>
              Australian award coverage is not New Zealand wage law. Pay figures need their own
              verified sources, effective dates and review before publication.
            </p>
          </Card>
          <Card title="Local business details">
            <p>
              Business identifiers, locations, tax settings and employer verification must be
              appropriate to the market. No NZ registration is claimed here.
            </p>
          </Card>
          <Card title="Privacy and choice">
            <p>
              Candidate information and cross-border handling require local privacy review.
              Employment decisions always remain with people.
            </p>
          </Card>
        </Cards>
      </Section>
      <Section title="Questions about a future market?">
        <p>
          Send an enquiry through <a href="/contact">our contact page</a>. We are not accepting
          applications, resumes or employer payments through this marketing website.
        </p>
      </Section>
    </>
  );
}
