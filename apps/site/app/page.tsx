import type { Metadata } from 'next';
import Image from 'next/image';
import { ArrowRight, Banknote, CalendarDays, Check, ShieldCheck, Users } from 'lucide-react';
import { SUPPORT_LINE, TAGLINE } from '@nua-crew/ui';
import { Card, Cards, Cta, Faq, Section, Steps } from './components';
import { JourneyPreview } from './journey-preview';
import { SITE, toApp, toHire } from '@/lib/site';

export const metadata: Metadata = {
  title: `NUA CREW — ${TAGLINE}`,
  alternates: { canonical: '/' },
};

export default function Home() {
  return (
    <>
      <header className="home-hero home-hero--branded">
        <figure className="home-hero__photo">
          <Image
            src="/visuals/home-hero.webp"
            alt="Hospitality professionals at work in a welcoming café and restaurant setting"
            fill
            sizes="100vw"
            priority
          />
        </figure>
        <div className="nua-container home-hero__grid">
          <div className="home-hero__copy">
            <span className="launch-pill">
              <span aria-hidden="true" />
              {SITE.productLive ? 'Starting in Melbourne' : 'In pre-launch · Starting in Melbourne'}
            </span>
            <p className="section-kicker">REAL WORK. REAL PEOPLE.</p>
            <h1>
              Better Jobs.
              <br />
              <span>Stronger Teams.</span>
            </h1>
            <p className="home-hero__lede">
              Find your next role. Meet your next teammate. Hospitality and local work, built around
              real life.
            </p>
            <div className="site-cta-row">
              <a className="nua-button" href={SITE.productLive ? toApp('/jobs') : '/job-seekers'}>
                I’m looking for work <ArrowRight size={18} aria-hidden="true" />
              </a>
              <a
                className="nua-button nua-button--secondary"
                href={SITE.productLive ? toHire('/register') : '/employers'}
              >
                I’m hiring <ArrowRight size={18} aria-hidden="true" />
              </a>
            </div>
            <p className="home-hero__note">
              <Check size={17} aria-hidden="true" />
              Free for job seekers across Australia.
            </p>
          </div>
        </div>
      </header>
      <div className="benefit-strip" aria-label="The NUA CREW approach">
        <div className="nua-container">
          <span>
            <Banknote aria-hidden="true" size={22} />
            Clear pay labels
          </span>
          <span>
            <CalendarDays aria-hidden="true" size={22} />
            Your availability, your call
          </span>
          <span>
            <ShieldCheck aria-hidden="true" size={22} />
            Contact by mutual choice
          </span>
        </div>
      </div>
      <Section
        id="picture-the-possibilities"
        title="See what NUA CREW helps you do."
        intro="Explore the journey visually, from finding the right opportunity to keeping track of an application."
      >
        <div className="nua-visual-grid">
          <article className="nua-visual-card">
            <Image
              src="/visuals/job-discovery.webp"
              alt="Illustrated NUA CREW mobile job discovery interface with hospitality job cards"
              width={1400}
              height={1060}
              sizes="(max-width: 799px) 100vw, 50vw"
              loading="lazy"
            />
            <div className="nua-visual-card__copy">
              <p className="section-kicker">FOR JOB SEEKERS</p>
              <h3>Find a role that fits.</h3>
              <p>Explore hospitality work by role, location and availability, with clearer information before you apply.</p>
              <a className="text-link" href="/job-seekers">
                See the job seeker journey <ArrowRight size={17} aria-hidden="true" />
              </a>
            </div>
          </article>
          <article className="nua-visual-card">
            <Image
              src="/visuals/applications.webp"
              alt="Illustration of an application journey displayed in the NUA CREW app"
              width={1400}
              height={1060}
              sizes="(max-width: 799px) 100vw, 50vw"
              loading="lazy"
            />
            <div className="nua-visual-card__copy">
              <p className="section-kicker">ONE PLACE TO APPLY</p>
              <h3>Know your next step.</h3>
              <p>View applications, invitations and hiring updates in a single place as the product moves through testing.</p>
              <a className="text-link" href="/apps">
                See the app walkthrough <ArrowRight size={17} aria-hidden="true" />
              </a>
            </div>
          </article>
        </div>
        <p className="nua-visual-note">Concept illustrations, not screenshots of live accounts. NUA CREW's hiring apps remain in pre-launch testing.</p>
      </Section>
      <Section
        id="your-experience"
        title="Your next move. On your terms."
        intro="One platform. Two simple ways to get started."
      >
        <JourneyPreview />
      </Section>
      <Section tone="alt" title="Less guesswork. More clarity." intro={SUPPORT_LINE}>
        <Cards>
          <Card icon="$" title="Know the pay">
            <p>
              Disclosed, estimated or not published. Every listing tells you where its pay
              information comes from.
            </p>
            <a className="text-link" href="/job-seekers">
              Explore jobs <ArrowRight size={17} aria-hidden="true" />
            </a>
          </Card>
          <Card icon="5" title="Make work fit life">
            <p>
              Permanent work, temporary work or both. Set your times while keeping your private
              calendar to yourself.
            </p>
            <a className="text-link" href="/how-it-works">
              See how it works <ArrowRight size={17} aria-hidden="true" />
            </a>
          </Card>
          <Card icon="✓" title="Choose the conversation">
            <p>
              Turn discovery on when you’re ready. Accept or decline an invitation, with no reason
              required.
            </p>
            <a className="text-link" href="/trust">
              Your privacy controls <ArrowRight size={17} aria-hidden="true" />
            </a>
          </Card>
        </Cards>
      </Section>
      <Section
        title="A little setup. A clearer next step."
        intro="How consent-based discovery works once the product opens."
      >
        <Steps
          items={[
            {
              title: 'Tell us what fits',
              body: 'Add your skills and work preferences. Choose whether employers can find you.',
            },
            {
              title: 'Find common ground',
              body: 'Verified employers search by skills, suburb and the time they need.',
            },
            {
              title: 'Choose to connect',
              body: 'See the role, pay and hours. Accept an invitation only if it feels right.',
            },
            {
              title: 'Talk it through',
              body: 'An accepted invitation opens a conversation. It does not accept a job or reserve a shift.',
            },
          ]}
        />
      </Section>
      <Section
        tone="wine"
        title="Small team. Big plans?"
        intro="Spend less time sorting through noise and more time meeting people."
      >
        <div className="employer-callout">
          <div>
            <span className="section-kicker">NUA CREW HIRE</span>
            <h3>
              A clear role.
              <br />A stronger starting point.
            </h3>
            <p>Disclosed pay. Consenting talent. A shared applicant pipeline.</p>
            <div className="site-cta-row">
              <Cta href="/employers">
                Explore employer tools <ArrowRight size={18} aria-hidden="true" />
              </Cta>
              <Cta href="/pricing" ghost>
                View planned pricing
              </Cta>
            </div>
          </div>
          <div className="price-feature">
            <span>PLANNED ADVERTISEMENT</span>
            <p>A$19</p>
            <strong>14 days. No automatic renewal.</strong>
            <small>
              Billing is not live. Promotion is a separate A$30 / 5-day add-on, subject to capacity.
            </small>
          </div>
        </div>
      </Section>
      <Section title="A few good questions">
        <Faq
          items={[
            {
              q: 'Can I use NUA CREW today?',
              a: (
                <p>
                  {SITE.productLive
                    ? 'The web product is open.'
                    : 'The website is live; the hiring product is still in pre-launch testing.'}{' '}
                  Check <a href="/apps">app and web status</a> for access. App-store links appear
                  only when the apps are published.
                </p>
              ),
            },
            {
              q: 'Is it free to look for work?',
              a: <p>Yes. Employees join and apply free in every Australian state and territory.</p>,
            },
            {
              q: 'Who can see my details?',
              a: (
                <p>
                  Discovery is off by default. Consenting profiles show limited details; your
                  minimum pay and calendar stay private.{' '}
                  <a href="/trust">See what employers can see.</a>
                </p>
              ),
            },
            {
              q: 'Where are you starting?',
              a: (
                <p>
                  Melbourne hospitality and local services first, with job seeker access planned
                  across Australia.
                </p>
              ),
            },
          ]}
        />
      </Section>
      <Section
        tone="alt"
        title="See the details before you get started"
        intro="Resumes and RSA certificates. Clear pay guidance. Shift records. A hiring team with the right access."
      >
        <div className="site-cta-row">
          <Cta href="/features">Explore the visual feature guide</Cta>
          <Cta href="/help" ghost>
            Quick answers
          </Cta>
        </div>
        <p style={{ marginTop: 20 }}>
          Part of the <a href="https://www.nuapos.com.au">NUA POS</a> family. Job seekers do not
          need a POS subscription.
        </p>
      </Section>
    </>
  );
}
