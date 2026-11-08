import { buildMetadata } from '@/lib/seo';
import {
  ArrowRight,
  BriefcaseBusiness,
  CalendarDays,
  MessageCircle,
  Monitor,
  ShieldCheck,
  Smartphone,
  Users,
} from 'lucide-react';
import {
  AvailabilityScreen,
  DeviceMockup,
  InvitationScreen,
  PageHero,
  Section,
} from '../components';
import { AppWalkthrough } from '../app-walkthrough';
import { VisualShowcase } from '../visual-showcase';
import { LAUNCH, SITE } from '@/lib/site';

export const metadata = buildMetadata('/apps');

export default function Apps() {
  return (
    <>
      <PageHero
        eyebrow="APP AND WEB STATUS"
        title="Good things are taking shape."
        lede="A simpler way to find work and build a team. Here’s where each experience stands."
      >
        <div className="platform-labels">
          <span>
            <Smartphone size={18} aria-hidden="true" />
            Android & iOS · In testing
          </span>
          <span>
            <Monitor size={18} aria-hidden="true" />
            Web · {LAUNCH.anyOpen ? 'Limited pilot access' : 'Pre-launch'}
          </span>
        </div>
      </PageHero>
      <Section
        title="One app, on Android and iPhone"
        intro="The same experience on both platforms. These are illustrations with fictional sample data, and the apps are still in testing."
      >
        <div className="device-pair">
          <DeviceMockup
            platform="android"
            label="Illustration of the NUA CREW availability screen on an Android phone"
          >
            <AvailabilityScreen />
          </DeviceMockup>
          <DeviceMockup
            platform="ios"
            label="Illustration of the NUA CREW invitation screen on an iPhone"
          >
            <InvitationScreen />
          </DeviceMockup>
        </div>
      </Section>
      <Section
        tone="alt"
        title="See how the app works"
        intro="The same app runs on Android and iOS. Tap through the steps to see what you can do before you sign up."
      >
        <AppWalkthrough />
      </Section>
      <Section
        title="A closer look at the app"
        intro="Sample visual journeys for Android and iOS. App access remains in testing."
      >
        <VisualShowcase audience="mobile" limit={4} />
      </Section>
      <Section
        id="access"
        title="Choose your experience"
        intro="The public website is live. Not in the app stores yet; download links will appear when published."
      >
        <div className="site-cards">
          <article id="job-seekers" className="site-card launch-card">
            <span className="site-icon">
              <BriefcaseBusiness size={24} aria-hidden="true" />
            </span>
            <p className="section-kicker">FOR JOB SEEKERS</p>
            <h3>Your next role, on your terms.</h3>
            <p>Free across every Australian state and territory.</p>
            <ul className="visual-features">
              <li>
                <CalendarDays size={20} aria-hidden="true" />
                Search jobs and share your availability
              </li>
              <li>
                <MessageCircle size={20} aria-hidden="true" />
                Apply, track and reply to invitations
              </li>
              <li>
                <ShieldCheck size={20} aria-hidden="true" />
                Control discovery and your private data
              </li>
            </ul>
            <p className="site-note">
              {LAUNCH.entries.employee.open
                ? 'Registration is open for approved pilot users. Mobile apps are in testing.'
                : 'Pilot registration not yet open. Nobody can create an account yet, and no data is collected here.'}
            </p>
            <a
              className="text-link"
              href={LAUNCH.entries.employee.open ? LAUNCH.entries.employee.href : '/job-seekers'}
            >
              {LAUNCH.entries.employee.open
                ? LAUNCH.entries.employee.label
                : 'Explore job seeker tools'}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            {LAUNCH.entries.employee.open && LAUNCH.appBase ? (
              <p className="site-note">
                Already registered? <a href={`${LAUNCH.appBase}/login`}>Employee log in</a>.
              </p>
            ) : null}
          </article>
          <article id="employers" className="site-card launch-card">
            <span className="site-icon">
              <Users size={24} aria-hidden="true" />
            </span>
            <p className="section-kicker">FOR EMPLOYERS</p>
            <h3>Your team’s next chapter.</h3>
            <p>One workspace for clearer, more respectful hiring.</p>
            <ul className="visual-features">
              <li>
                <BriefcaseBusiness size={20} aria-hidden="true" />
                Post roles with clear pay
              </li>
              <li>
                <Users size={20} aria-hidden="true" />
                Review applicants and consenting talent
              </li>
              <li>
                <MessageCircle size={20} aria-hidden="true" />
                Keep invitations and messages together
              </li>
            </ul>
            <p className="site-note">
              {LAUNCH.entries.employer.open
                ? 'Business registration is open for approved pilot users. Publishing needs business verification.'
                : 'Pilot registration not yet open. Employer registration and payments are not open yet.'}
            </p>
            <a
              className="text-link"
              href={LAUNCH.entries.employer.open ? LAUNCH.entries.employer.href : '/employers'}
            >
              {LAUNCH.entries.employer.open
                ? LAUNCH.entries.employer.label
                : 'Explore employer tools'}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
            {LAUNCH.entries.employer.open && LAUNCH.hireBase ? (
              <p className="site-note">
                Already registered? <a href={`${LAUNCH.hireBase}/login`}>Employer log in</a>.
              </p>
            ) : null}
          </article>
          <article id="post-a-job" className="site-card launch-card">
            <span className="site-icon">
              <BriefcaseBusiness size={24} aria-hidden="true" />
            </span>
            <p className="section-kicker">POST A JOB</p>
            <h3>Post a role with clear pay.</h3>
            <p>
              Planned pricing: A$49 for a 14-day advertisement, an optional A$30 5-day promotion, or
              A$79 for both.
            </p>
            <p className="site-note">
              {LAUNCH.entries['post-job'].open
                ? 'Posting is open for approved pilot employers. Payments are not switched on.'
                : 'Posting is not open yet and payments are not switched on. You will need a verified business account first.'}
            </p>
            <a
              className="text-link"
              href={LAUNCH.entries['post-job'].open ? LAUNCH.entries['post-job'].href : '/pricing'}
            >
              {LAUNCH.entries['post-job'].open
                ? LAUNCH.entries['post-job'].label
                : 'See planned pricing'}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
          </article>
        </div>
        {SITE.contactEmail ? (
          <p style={{ marginTop: 24 }}>
            Ask about launch: <a href={`mailto:${SITE.contactEmail}`}>{SITE.contactEmail}</a>.
          </p>
        ) : null}
      </Section>
    </>
  );
}
