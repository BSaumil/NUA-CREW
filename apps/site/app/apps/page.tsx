import type { Metadata } from 'next';
import { Card, Cards, PageHero, PrimaryLink, Section } from '../components';
import { SITE } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Android and iOS apps',
  description: 'NUA CREW for Android and iOS: current status and what the apps do.',
  alternates: { canonical: '/apps' },
};

export default function Apps() {
  return (
    <>
      <PageHero
        eyebrow="Android and iOS"
        title="The apps are coming."
        lede="NUA CREW is built phone-first. We are testing it now and will link the stores here once the apps are published."
      />
      <Section>
        <p className="site-note" role="note">
          <strong>Not in the app stores yet.</strong> There is no download link because there is
          nothing to download publicly. We will not link a store listing until it exists.
        </p>
        <Cards>
          <Card title="Job seeker app">
            <ul className="site-list">
              <li>Search, filters, near me and saved searches</li>
              <li>Apply, track and withdraw</li>
              <li>Work preferences and availability</li>
              <li>Invitations inbox and messages</li>
              <li>Face ID or fingerprint app lock</li>
              <li>Push notifications, opt-in, with no private details on the lock screen</li>
              <li>Export or delete your data</li>
            </ul>
          </Card>
          <Card title="Hiring workspace">
            <ul className="site-list">
              <li>Post and manage jobs</li>
              <li>Review applicants</li>
              <li>Find people who chose to be found</li>
              <li>Invitations and messages</li>
            </ul>
          </Card>
          <Card title="Today, on the web">
            <p>The same product works in a browser.</p>
            <p>
              <a href={`${SITE.appUrl}/jobs`}>NUA CREW Jobs</a>
            </p>
            <p>
              <a href={`${SITE.hireUrl}/login`}>NUA CREW Hire</a>
            </p>
          </Card>
        </Cards>
        <p style={{ marginTop: 20 }}>
          Want to be told when it launches? Email{' '}
          <a href={`mailto:${SITE.contactEmail}?subject=Tell%20me%20when%20the%20apps%20launch`}>
            {SITE.contactEmail}
          </a>
          .
        </p>
        <PrimaryLink href="/job-seekers">What the app does</PrimaryLink>
      </Section>
    </>
  );
}
