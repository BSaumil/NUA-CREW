import { FeatureExplorer } from '../feature-explorer';
import { VisualShowcase } from '../visual-showcase';
import type { Metadata } from 'next';
import {
  AvailabilityScreen,
  Card,
  Cards,
  Cta,
  InvitationScreen,
  PageHero,
  Phone,
  Section,
} from '../components';
import { SITE, toApp } from '@/lib/site';

export const metadata: Metadata = {
  title: 'For job seekers',
  description:
    'Free for job seekers across Australia. Clear pay, honest matching, your availability on your terms, and invitations you can accept or decline without giving a reason.',
  alternates: { canonical: '/job-seekers' },
};

export default function JobSeekers() {
  return (
    <>
      <PageHero
        visual={{
          src: '/brand-kit/features/job-discovery.webp',
          alt: 'Illustration of NUA CREW hospitality job discovery on a phone',
          width: 1448,
          height: 987,
        }}
        eyebrow="NUA CREW Jobs"
        title="Find work that fits your life."
        lede="Search permanent and temporary roles, see what they pay, and decide who can find you. Free in every state and territory."
      >
        <div className="site-cta-row">
          <Cta href={toApp('/register')}>
            {SITE.productLive ? 'Create a free account' : 'See job seeker launch status'}
          </Cta>
          <Cta href="/apps" ghost>
            Android and iOS apps
          </Cta>
        </div>
      </PageHero>

      <nav className="page-shortcuts nua-container" aria-label="On this page">
        <a href="#explore">Explore features</a>
        <a href="/help#job-seekers">Common questions</a>
        <a href="/apps">Launch status</a>
      </nav>
      <Section
        id="explore"
        title="Bring your experience. Keep control."
        intro="Resumes, certificates and shift records, explained with simple examples."
      >
        <FeatureExplorer audience="jobs" />
      </Section>
      <Section
        title="Explore the job seeker experience"
        intro="Pictures of the journey from searching by role to tracking an application. These screens are concepts."
      >
        <VisualShowcase audience="jobs" exclude={['job-discovery']} />
      </Section>
      <Section title="Search and apply with your eyes open">
        <Cards>
          <Card icon="$" title="Pay you can see">
            <p>
              Each listing says whether pay is <strong>Disclosed</strong> by the employer or{' '}
              <strong>Estimated</strong> by us, and says plainly when it is not published. Filter by
              a minimum hourly rate.
            </p>
          </Card>
          <Card icon="≈" title="Find what fits">
            <p>
              Use skills, location and work preferences to narrow your search and find opportunities
              that fit your life.
            </p>
          </Card>
          <Card icon="◎" title="Near me, without tracking">
            <p>
              &ldquo;Near me&rdquo; uses your approximate location for that search only. It is
              rounded, sent once and never stored.
            </p>
          </Card>
          <Card icon="♡" title="Saved jobs and alerts">
            <p>
              Save the roles you like. Set search alerts and turn notifications off whenever you
              want.
            </p>
          </Card>
          <Card icon="✎" title="Apply once, track it">
            <p>
              Apply with a resume and a note, follow your application&apos;s timeline and withdraw
              whenever you like. Retrying a shaky connection never sends a duplicate.
            </p>
          </Card>
          <Card icon="!" title="Jobs hosted elsewhere say so">
            <p>
              Some roles come from licensed sources. We tell you before sending you to the
              employer&apos;s own site, and that we cannot see what happens after you apply there.
            </p>
          </Card>
        </Cards>
      </Section>

      <Section
        tone="alt"
        title="Permanent, temporary, or both"
        intro="You answer each separately, so choosing both never overwrites either. Switching one off keeps what you entered."
      >
        <div className="site-split">
          <ul className="site-list">
            <li>
              <strong>Permanent:</strong> hours pattern, notice period and the date you could start.
              That is a permanent start date, not whether you can work a shift tonight.
            </li>
            <li>
              <strong>Temporary:</strong> weekly times with several windows a day for split shifts,
              overnight windows, days off and extra days, and work you have already booked.
            </li>
            <li>
              <strong>Your minimum pay</strong> is private. It is never shown to employers or used
              to rank you.
            </li>
            <li>
              <strong>Time zones handled.</strong> Times are in your own zone, including the
              daylight-saving changeover nights.
            </li>
          </ul>
          <Phone label="A phone showing a weekly availability editor">
            <AvailabilityScreen />
          </Phone>
        </div>
      </Section>

      <Section
        title="You decide who can reach you"
        intro="A conversation opens only when you say yes."
      >
        <div className="site-split site-split--reverse">
          <Phone label="A phone showing an invitation with Accept and Decline buttons">
            <InvitationScreen />
          </Phone>
          <ul className="site-list">
            <li>Discovery is off by default and separate for permanent and temporary work.</li>
            <li>
              Invitations show the business, role, location, pay and hours. If the job changes, we
              show you what changed before you can accept.
            </li>
            <li>Decline without a reason. Pause new invitations whenever you want.</li>
            <li>
              Prefer, hide from, mute or block any employer. Blocking closes your conversations with
              them.
            </li>
            <li>Report a message to NUA CREW support from inside the conversation.</li>
            <li>
              Accepting is not an application, does not accept any job and does not reserve a shift.
            </li>
          </ul>
        </div>
      </Section>

      <Section tone="wine" title="Your data, your call">
        <ul className="site-list">
          <li>
            Request an export of your personal information through account controls or support.
          </li>
          <li>
            Request account deletion. Some safety, business or legal records may need to be
            retained; see our privacy policy.
          </li>
          <li>Optional app lock with Face ID or fingerprint; sign out everywhere.</li>
        </ul>
        <div className="site-cta-row">
          <Cta href="/trust">Read about trust and privacy</Cta>
          <Cta href={toApp('/register')} ghost>
            {SITE.productLive ? 'Create a free account' : 'See job seeker launch status'}
          </Cta>
        </div>
      </Section>
    </>
  );
}
