import type { Metadata } from 'next';
import { VenueBanners, VisualShowcase } from '../visual-showcase';
import { Card, Cards, Faq, PageHero, PrimaryLink, Section, Steps } from '../components';

export const metadata: Metadata = {
  title: 'How it works',
  description:
    'Permanent and temporary work, availability that stays private, and invitations that need a yes. How NUA CREW works for job seekers and employers.',
  alternates: { canonical: '/how-it-works' },
};

export default function HowItWorks() {
  return (
    <>
      <PageHero
        visual={{
          src: '/brand-kit/banners/temporary-shifts.webp',
          alt: 'NUA CREW temporary shifts concept showing roster and job invitations on mobile phones',
          width: 2048,
          height: 768,
        }}
        eyebrow="How it works"
        title="Mutual choice, step by step."
        lede="Choose the opportunities you want to explore and the conversations you want to start."
      />

      <Section title="Job seekers">
        <Steps
          items={[
            {
              title: 'Set up',
              body: 'Add a profile, skills and a resume. Tell us if you want permanent work, temporary work or both.',
            },
            {
              title: 'Search or be found',
              body: 'Search jobs with pay filters, or turn on discovery for the kinds of work you want.',
            },
            {
              title: 'Reply on your terms',
              body: 'Apply to jobs, or accept or decline invitations. No reason needed.',
            },
            {
              title: 'Talk',
              body: 'A conversation opens only after you accept. You can end it, report it or block the employer.',
            },
          ]}
        />
      </Section>

      <Section
        tone="alt"
        title="Availability, explained"
        intro="Availability is the part people worry about most, so here is exactly what it does."
      >
        <Cards>
          <Card title="Recurring times">
            <p>
              Weekly windows in your own time zone. Add several in one day for a break, and use an
              end time earlier than the start for an overnight window, such as 10 pm to 6 am.
            </p>
          </Card>
          <Card title="Days off and extra days">
            <p>
              One-off changes for a day or a range. &ldquo;Not available&rdquo; always wins over
              your weekly times.
            </p>
          </Card>
          <Card title="Booked work">
            <p>
              Work you have confirmed blocks overlapping times. Applying for a job does not book
              you; a separately accepted shift offer or work you add blocks time.
            </p>
          </Card>
          <Card title="Unknown stays unknown">
            <p>
              If you have not shared availability, an employer sees &ldquo;unknown&rdquo;. We never
              guess that you are free.
            </p>
          </Card>
          <Card title="What employers can see">
            <p>
              Free, not free or unknown for a time they ask about, and a weekly-hours fit. Not your
              calendar, not why, and not which of your reasons applies.
            </p>
          </Card>
          <Card title="Daylight saving">
            <p>
              A 10 pm to 6 am shift lasts 7 or 9 real hours on changeover nights, and we calculate
              it that way.
            </p>
          </Card>
        </Cards>
      </Section>

      <Section
        title="See how shift planning connects"
        intro="Illustrations showing availability, temporary shifts and attendance records."
      >
        <VisualShowcase audience="shifts" />
      </Section>

      <Section title="Employers">
        <Steps
          items={[
            {
              title: 'Register and verify',
              body: 'Business details, then a review of who operates the business.',
            },
            { title: 'Publish', body: 'Roles with pay, location, hours and dates.' },
            {
              title: 'Search and invite',
              body: 'People who chose to be found, availability for your time, then an invitation to a specific open job.',
            },
            {
              title: 'Hire',
              body: 'Your team reviews applications and conversations and decides.',
            },
          ]}
        />
      </Section>

      <Section tone="alt" title="What an invitation is, and is not">
        <Cards>
          <Card title="It is">
            <ul className="site-list">
              <li>An expression of hiring interest in one open job.</li>
              <li>A snapshot of the business, role, location, pay and hours when it was sent.</li>
              <li>Open for a few days, then it expires.</li>
            </ul>
          </Card>
          <Card title="It is not">
            <ul className="site-list">
              <li>A job offer, an application or a booking.</li>
              <li>A reservation of anyone&apos;s time.</li>
              <li>Permission to see contact details, a resume or a calendar.</li>
            </ul>
          </Card>
        </Cards>
        <p style={{ marginTop: 20 }}>
          If the job&apos;s pay, place or hours change after the invitation, the person must review
          the latest details before they can accept.
        </p>
      </Section>

      <Section
        title="Hospitality in all its forms"
        intro="From cafés and restaurants to hotels, events and growing hospitality careers."
      >
        <VenueBanners />
      </Section>

      <Section title="Want to see the details?">
        <p className="site-intro">
          Explore visual examples of document sharing, shifts, pay guidance and team access.
        </p>
        <PrimaryLink href="/features">Open the feature guide</PrimaryLink>
      </Section>
      <Section title="Questions">
        <Faq
          items={[
            {
              q: 'What happens if I decline?',
              a: <p>Nothing else. That employer cannot invite you again for 30 days.</p>,
            },
            {
              q: 'Can I pause invitations without hiding?',
              a: (
                <p>
                  Yes. Pausing stops new invitations only; your conversations carry on until you end
                  or block them.
                </p>
              ),
            },
            {
              q: 'How is pay compared?',
              a: (
                <p>
                  Only against the disclosed pay of the employer&apos;s own job, and only as
                  &ldquo;fits&rdquo; or &ldquo;not confirmed&rdquo;, so nobody can work out your
                  minimum.
                </p>
              ),
            },
            {
              q: 'Are contractors supported?',
              a: (
                <p>
                  You can say you are open to contracting, but that is a preference only. We do not
                  check an ABN or decide whether anyone is an employee or a contractor.
                </p>
              ),
            },
          ]}
        />
        <p>
          <PrimaryLink href="/trust">Read the trust and privacy page</PrimaryLink>
        </p>
      </Section>
    </>
  );
}
