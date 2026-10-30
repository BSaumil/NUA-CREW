import type { Metadata } from 'next';
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
import { PageHero, Section } from '../components';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'App and web status',
  description: 'Verified access links and launch status for NUA CREW job seekers and employers.',
  alternates: { canonical: '/apps' },
};

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
            Web · {SITE.productLive ? 'Open' : 'Pre-launch'}
          </span>
        </div>
      </PageHero>
      <Section
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
              {SITE.productLive
                ? 'Web access is open. Mobile apps are in testing.'
                : 'In testing. Public registration is not open yet.'}
            </p>
            <a
              className="text-link"
              href={SITE.productLive ? `${SITE.appUrl}/jobs` : '/job-seekers'}
            >
              {SITE.productLive ? 'Browse jobs' : 'Explore job seeker tools'}
              <ArrowRight size={18} aria-hidden="true" />
            </a>
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
              {SITE.productLive
                ? 'Web access is open. Mobile apps are in testing.'
                : 'In testing. Employer registration and payments are not open yet.'}
            </p>
            <a
              className="text-link"
              href={SITE.productLive ? `${SITE.hireUrl}/register` : '/employers'}
            >
              {SITE.productLive ? 'Register your business' : 'Explore employer tools'}
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
