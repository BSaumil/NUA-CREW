import { FeatureExplorer } from '../feature-explorer';
import type { Metadata } from 'next';
import { Card, Cards, Cta, PageHero, Phone, Section, Steps, TalentScreen } from '../components';
import { SITE, toHire } from '@/lib/site';

export const metadata: Metadata = {
  title: 'For employers',
  description:
    'Post roles with disclosed pay, find people who chose to be found, check who is free for the time you need, and invite them. A$19 per 14-day advertisement.',
  alternates: { canonical: '/employers' },
};

export default function Employers() {
  return (
    <>
      <PageHero
        eyebrow="NUA CREW Hire"
        title="Good people. A clearer way to hire."
        lede="Post a role. Find consenting talent. Start a conversation. Your team makes every hiring decision."
      >
        <div className="site-cta-row">
          <Cta href={toHire('/register')}>
            {SITE.productLive ? 'Register your business' : 'See employer launch status'}
          </Cta>
          <Cta href="/pricing" ghost>
            See pricing
          </Cta>
        </div>
      </PageHero>

      <nav className="page-shortcuts nua-container" aria-label="On this page">
        <a href="#explore">Explore features</a>
        <a href="/help#employers">Common questions</a>
        <a href="/apps">Launch status</a>
      </nav>
      <Section
        id="explore"
        title="See how the details fit together"
        intro="Pay guidance, team permissions and shift records, without the guesswork."
      >
        <FeatureExplorer audience="hire" />
      </Section>
      <Section title="What you can do">
        <Cards>
          <Card icon="1" title="Post roles clearly">
            <p>
              Show pay, location, hours and work type up front. Edit, pause or close the role when
              plans change.
            </p>
          </Card>
          <Card icon="2" title="Get verified">
            <p>
              Verification shows we reviewed who operates the business. It is not an endorsement,
              and you must be verified before you publish or search.
            </p>
          </Card>
          <Card icon="3" title="Run your applicants">
            <p>
              Keep applications, private notes and decisions in one pipeline. People decide;
              rejections need a human reason.
            </p>
          </Card>
          <Card icon="4" title="Find people who chose to be found">
            <p>
              Search by skills, suburb and work type. See limited profiles only from people who
              opted in.
            </p>
          </Card>
          <Card icon="5" title="Check availability for the time you need">
            <p>
              Ask about a time window. See free, not free or unknown. A person’s private calendar
              stays private.
            </p>
          </Card>
          <Card icon="6" title="Invite and talk">
            <p>
              Invite someone to an open role. An accepted invitation opens a shared team
              conversation.
            </p>
          </Card>
        </Cards>
      </Section>

      <Section tone="alt" title="How hiring works here">
        <Steps
          items={[
            {
              title: 'Register and verify',
              body: 'Create your business account. We review evidence about who runs it.',
            },
            {
              title: 'Publish a role',
              body: 'Add pay, location, hours and dates. Pay is shown as Disclosed.',
            },
            {
              title: 'Search and invite',
              body: 'Find consenting people, check availability, and invite them to the role.',
            },
            {
              title: 'Decide',
              body: 'Review applications and conversations. People make every decision.',
            },
          ]}
        />
      </Section>

      <Section
        tone="wine"
        title="Respectful by design"
        intro="Limits protect candidates, and they protect your reputation."
      >
        <div className="site-split">
          <ul className="site-list">
            <li>
              Invitation limits per business, per job and per person, shared by your whole team.
            </li>
            <li>A 30-day pause after someone declines. A teammate cannot get around it.</li>
            <li>People can hide from you or block you, and you never see who did.</li>
            <li>
              A daily cap on how many different people you can look at, to reduce probing. It
              narrows the risk; it does not promise anonymity.
            </li>
            <li>
              See only the profile information people choose to share, without access to their
              minimum pay.
            </li>
          </ul>
          <Phone label="A phone showing talent search results with availability labels">
            <TalentScreen />
          </Phone>
        </div>
      </Section>

      <Section title="On your phone or on the web">
        <p className="site-intro">
          {SITE.productLive
            ? 'The hiring workspace is available on the web.'
            : 'The web hiring workspace is in pre-launch testing.'}{' '}
          Android and iOS apps are also in testing. Check launch status for verified access links.
        </p>
        <div className="nua-row">
          <a className="nua-button" href={toHire('/register')}>
            {SITE.productLive ? 'Register your business' : 'See employer launch status'}
          </a>
          <a className="nua-button nua-button--secondary" href="/apps">
            App status
          </a>
        </div>
      </Section>
    </>
  );
}
