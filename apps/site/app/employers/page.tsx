import type { Metadata } from 'next';
import { Card, Cards, Cta, PageHero, Phone, Section, Steps, TalentScreen } from '../components';
import { toHire } from '@/lib/site';

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
        title="Meet qualified people without unnecessary noise."
        lede="Post a role, find people who agreed to be found, see who is free when you need them, and invite them. Every hiring decision stays with your team."
      >
        <div className="site-cta-row">
          <Cta href={toHire('/register')}>Register your business</Cta>
          <Cta href="/pricing" ghost>
            See pricing
          </Cta>
        </div>
      </PageHero>

      <Section title="What you can do">
        <Cards>
          <Card icon="1" title="Post roles clearly">
            <p>
              Disclosed pay, location and an arrangement that keeps employment basis, duration and
              hours separate (&ldquo;not specified&rdquo; is fine). Edit, unpublish or close at any
              time.
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
              A pipeline of real applications with private notes, a required human reason for any
              rejection, and a clear history. No automatic screening or rejection.
            </p>
          </Card>
          <Card icon="4" title="Find people who chose to be found">
            <p>
              Search permanent or temporary talent by suburb and skills. Results show a first name
              and last initial, headline, suburb, skills and a short list of what is unknown.
            </p>
          </Card>
          <Card icon="5" title="Check availability for the time you need">
            <p>
              Ask about a date and time and get free, not free or unknown, plus weekly-hours fit.
              You never see a calendar, and unknown is never presented as free.
            </p>
          </Card>
          <Card icon="6" title="Invite and talk">
            <p>
              Send a short note with a specific open job. If they accept, you get one conversation.
              Your team shares the thread, and removing a teammate cuts their access straight away.
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
              No hidden ranking, no secret scores, and no access to anyone&apos;s minimum pay.
            </li>
          </ul>
          <Phone label="A phone showing talent search results with availability labels">
            <TalentScreen />
          </Phone>
        </div>
      </Section>

      <Section title="On your phone or on the web">
        <p className="site-intro">
          NUA CREW Hire works on the web today, and a native Android and iOS hiring workspace is in
          testing for posting jobs, reviewing applicants, finding people and messaging.
        </p>
        <div className="nua-row">
          <a className="nua-button" href={toHire('/register')}>
            Register your business
          </a>
          <a className="nua-button nua-button--secondary" href="/apps">
            App status
          </a>
        </div>
      </Section>
    </>
  );
}
