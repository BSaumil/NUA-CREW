import type { Metadata } from 'next';
import { SUPPORT_LINE, TAGLINE } from '@nua-crew/ui';
import {
  AvailabilityScreen,
  Card,
  Cards,
  Cta,
  Faq,
  InvitationScreen,
  Phone,
  Section,
  Steps,
  TalentScreen,
} from './components';
import { toApp, toHire } from '@/lib/site';

export const metadata: Metadata = {
  title: `NUA CREW — ${TAGLINE}`,
  alternates: { canonical: '/' },
};

export default function Home() {
  return (
    <>
      <header className="site-hero">
        <div className="nua-container site-hero__grid" style={{ padding: '0 16px' }}>
          <div>
            <p className="site-eyebrow">Permanent jobs · Temporary work · Australia</p>
            <h1>{TAGLINE}</h1>
            <p className="lede">
              {SUPPORT_LINE} Clear pay, honest matching and mutual choice for job seekers and
              employers, starting with hospitality and local services in Melbourne.
            </p>
            <div className="site-cta-row">
              <Cta href={toApp('/register')}>Find work</Cta>
              <Cta href={toHire('/register')} ghost>
                Hire with NUA CREW
              </Cta>
            </div>
            <p style={{ marginTop: 20, color: '#cbbfb6' }}>
              Free for job seekers in every state and territory, on Android, iOS and the web.
            </p>
          </div>
          <Phone label="A phone showing an invitation from Fitzroy Cafe with pay, hours and Accept and Decline buttons">
            <InvitationScreen />
          </Phone>
        </div>
      </header>

      <Section
        title="Two ways in. One honest marketplace."
        intro="Whether you want a permanent role, a few shifts a week, or both, you set the terms, and employers only reach you if you chose to be found."
      >
        <Cards>
          <Card icon="J" title="NUA CREW Jobs">
            <p>
              Search permanent and temporary roles, see whether pay is disclosed, and apply with a
              resume and a note.
            </p>
            <p>
              <a href="/job-seekers">See what job seekers get →</a>
            </p>
          </Card>
          <Card icon="H" title="NUA CREW Hire">
            <p>
              Post a role, find people who agreed to be found, check who is free for the time you
              need, and invite them. Every hiring decision stays yours.
            </p>
            <p>
              <a href="/employers">See what employers get →</a>
            </p>
          </Card>
          <Card icon="✓" title="Trust you can check">
            <p>
              Verified means we reviewed who runs the business, not that we endorse it. Match scores
              are estimates, never promises.
            </p>
            <p>
              <a href="/trust">How trust and privacy work →</a>
            </p>
          </Card>
        </Cards>
      </Section>

      <Section
        tone="alt"
        title="Built around how people really work"
        intro="Permanent and temporary work are different, so you answer each separately. Choosing both never overwrites either."
      >
        <div className="site-split">
          <div>
            <ul className="site-list">
              <li>
                <strong>Permanent or temporary, or both.</strong> Notice period and start date for
                permanent work; weekly times, breaks and overnight windows for temporary work.
              </li>
              <li>
                <strong>Availability you control.</strong> Employers only learn whether you are free
                for a time they ask about, never your calendar. If you share nothing, you show as
                &ldquo;unknown&rdquo;, never as available.
              </li>
              <li>
                <strong>Pay shown plainly.</strong> Pay is labelled Disclosed or Estimated, and a
                missing figure says so. Your own minimum pay stays private.
              </li>
              <li>
                <strong>Employers you prefer or avoid.</strong> Prefer, hide from, mute or block any
                business.
              </li>
            </ul>
            <p>
              <a href="/how-it-works">See how it works →</a>
            </p>
          </div>
          <Phone label="A phone showing a weekly availability editor with split shifts and an overnight window">
            <AvailabilityScreen />
          </Phone>
        </div>
      </Section>

      <Section
        title="From search to conversation in four steps"
        intro="No cold messages. A conversation opens only when a person says yes."
      >
        <Steps
          items={[
            {
              title: 'Choose to be found',
              body: 'Turn on discovery for permanent work, temporary work or both. It is off until you decide.',
            },
            {
              title: 'Employers search',
              body: 'Verified employers see your first name and last initial, headline, suburb, skills and whether you are free for a time they ask about.',
            },
            {
              title: 'You get an invitation',
              body: 'It shows the business, role, location, pay and hours. Accept or decline; you never have to give a reason.',
            },
            {
              title: 'Talk it through',
              body: 'Accepting opens one conversation. It is not a job offer, and shares no contact details, resume or calendar.',
            },
          ]}
        />
      </Section>

      <Section
        tone="wine"
        title="Meet qualified people without unnecessary noise"
        intro="Employers get search, availability fit and invitations with limits that protect people from spam."
      >
        <div className="site-split site-split--reverse">
          <Phone label="A phone showing a talent search result list with availability labels and an invite button">
            <TalentScreen />
          </Phone>
          <div>
            <ul className="site-list">
              <li>Only people who chose to be found appear, and results are not ranked.</li>
              <li>
                Availability is answered for the time you ask about: free, not free or unknown.
              </li>
              <li>
                Invitation limits, a cooldown after a decline and a block button keep it respectful.
              </li>
              <li>An ad costs A$19 for 14 days. Nothing renews automatically.</li>
            </ul>
            <div className="site-cta-row">
              <Cta href="/employers">Explore NUA CREW Hire</Cta>
              <Cta href="/pricing" ghost>
                See pricing
              </Cta>
            </div>
          </div>
        </div>
      </Section>

      <Section title="Common questions">
        <Faq
          items={[
            {
              q: 'Is NUA CREW live?',
              a: (
                <p>
                  It is in pre-launch. The apps are in internal testing and are not in the app
                  stores yet. See <a href="/apps">the apps page</a> for status.
                </p>
              ),
            },
            {
              q: 'Does it cost anything to look for work?',
              a: (
                <p>
                  No. Job seeker access is free across every Australian state and territory, and
                  does not depend on any employer paying.
                </p>
              ),
            },
            {
              q: 'Does AI decide who gets hired?',
              a: (
                <p>
                  No. Match scores are explainable estimates that never predict whether you will be
                  hired, and employers make every hiring decision. There are no automatic
                  rejections.
                </p>
              ),
            },
            {
              q: 'Who can see my information?',
              a: (
                <p>
                  Only what you choose. Employers see a short, limited profile only if you turned
                  discovery on, and never your minimum pay or calendar. You can export or delete
                  your data in the app. Details are on the <a href="/trust">trust page</a>.
                </p>
              ),
            },
            {
              q: 'Where does it work?',
              a: (
                <p>
                  We are starting with hospitality and local services in Melbourne. Job seeker
                  access is open to all Australian states and territories.
                </p>
              ),
            },
          ]}
        />
      </Section>
    </>
  );
}
