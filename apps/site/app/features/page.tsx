import { buildMetadata } from '@/lib/seo';
import { Card, Cards, Cta, PageHero, Section } from '../components';
import { FeatureExplorer } from '../feature-explorer';
import { VisualShowcase } from '../visual-showcase';
export const metadata = buildMetadata('/features');
export default function Features() {
  return (
    <>
      <PageHero
        eyebrow="THE PRODUCT, EXPLAINED"
        title="Less to figure out. More to get on with."
        lede="See the everyday details that make finding work and hiring feel clearer."
      >
        <div className="site-cta-row">
          <Cta href="/job-seekers">For job seekers</Cta>
          <Cta href="/employers" ghost>
            For employers
          </Cta>
        </div>
      </PageHero>
      <Section
        title="Take a closer look"
        intro="Choose a topic. Every preview shows what it means for you, including its limits."
      >
        <FeatureExplorer />
      </Section>
      <Section
        title="Search, availability and shifts, illustrated"
        intro="Six visual explanations of how people find work and keep track of it. Hiring, documents and pay guidance are shown in the interactive previews above. The pictures show concepts, not live screens."
      >
        <VisualShowcase />
      </Section>
      <Section tone="alt" title="Know what is available">
        <Cards>
          <Card icon="✓" title="Public website · Live">
            <p>Explore the product, planned pricing, policies and support details today.</p>
          </Card>
          <Card icon="5" title="Web, Android & iOS · In testing">
            <p>
              Hiring, document uploads and shift workflows are not open for public use. Store links
              will appear on the app-status page.
            </p>
          </Card>
          <Card icon="$" title="Payments & integrations · Not live">
            <p>
              Employer payments are disabled. NUA POS membership does not currently sync accounts,
              payroll or candidate data with NUA CREW.
            </p>
          </Card>
        </Cards>
      </Section>
      <Section title="Part of NUA POS. Built around people.">
        <p className="site-intro">
          NUA CREW is the recruitment product in the NUA POS family. Job seekers do not need a POS
          subscription, and looking for work is free across Australia.
        </p>
        <div className="site-cta-row">
          <Cta href="/help">Quick answers</Cta>
          <Cta href="/apps" ghost>
            App and web status
          </Cta>
        </div>
      </Section>
    </>
  );
}
