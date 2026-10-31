import { buildMetadata } from '@/lib/seo';
import { Card, Cards, PageHero, PrimaryLink, Section } from '../components';

export const metadata = buildMetadata('/trust');

export default function Trust() {
  return (
    <>
      <PageHero
        eyebrow="Trust & privacy"
        title="Plain answers about trust."
        lede="What our labels mean, what employers can see, and what you control."
      />

      <Section>
        <p className="site-note">
          Product privacy controls described here are in pre-launch testing. This public website
          does not accept accounts, applications or documents.{' '}
          <a href="/privacy">Read the privacy policy</a> for current website and enquiry handling.
        </p>
      </Section>
      <Section title="What our labels mean">
        <Cards>
          <Card title="Verified business">
            <p>
              We reviewed evidence about who operates the business. It is not an endorsement and it
              says nothing about pay or conditions beyond what is listed.
            </p>
          </Card>
          <Card title="Disclosed and estimated pay">
            <p>
              <strong>Disclosed</strong> pay comes from the employer. <strong>Estimated</strong> pay
              is our inference and is always labelled. If pay is not published we say so.
            </p>
          </Card>
          <Card title="Contact by choice">
            <p>
              Choose whether employers can find you. Accept or decline invitations on your terms;
              accepting a conversation does not accept a job.
            </p>
          </Card>
        </Cards>
      </Section>

      <Section tone="alt" title="What employers can and cannot see">
        <div className="site-cards">
          <article className="site-card">
            <h3>Can see, only if you turn discovery on</h3>
            <ul className="site-list">
              <li>First name and last initial</li>
              <li>Headline, suburb and state, up to eight skills</li>
              <li>Free, not free or unknown for a time they ask about</li>
              <li>Notice period and start date, for permanent work</li>
            </ul>
          </article>
          <article className="site-card">
            <h3>Cannot see</h3>
            <ul className="site-list">
              <li>Your minimum pay or your calendar</li>
              <li>Your email, phone or postcode</li>
              <li>Which employers you hide from, mute or block</li>
              <li>Your account ID. The reference they get is different for every employer</li>
            </ul>
          </article>
          <article className="site-card">
            <h3>Limits we put on employers</h3>
            <ul className="site-list">
              <li>Verified businesses only</li>
              <li>Results are not ranked</li>
              <li>Invitation limits, a decline cooldown and a daily cap on people viewed</li>
              <li>Every search and invitation is recorded for accountability</li>
            </ul>
          </article>
        </div>
        <p style={{ marginTop: 20 }}>
          <strong>What we cannot promise.</strong> Hiding from an employer matches their NUA CREW
          record, so it cannot stop a business trading under another name from finding you, or
          someone who already knows you. A time-based search reveals one thing about you, free or
          not, for that time. We narrow that with limits; we do not claim anonymity.
        </p>
      </Section>

      <Section title="Your controls">
        <Cards>
          <Card title="Consent">
            <p>
              Discovery is off until you turn it on, separately for permanent and temporary work,
              and turning a kind off withdraws it.
            </p>
          </Card>
          <Card title="Invitations and messages">
            <p>
              Decline without a reason, pause new invitations, end a conversation, block or report.
              Blocking cuts the employer off from the thread.
            </p>
          </Card>
          <Card title="Your data">
            <p>
              Request access, correction, an available export or deletion through account controls
              or support. Limited safety, audit, shared business and legally required records may be
              retained, as explained in the privacy policy.
            </p>
          </Card>
        </Cards>
      </Section>

      <Section tone="alt" title="How we build it">
        <ul className="site-list">
          <li>Employer data is separated in the database as well as in the application.</li>
          <li>Feeds, resumes and listings are treated as untrusted data, never as instructions.</li>
          <li>Job sources are used only with a recorded permission.</li>
          <li>Humans make hiring decisions. There is no automatic rejection.</li>
        </ul>
        <p>
          Questions or concerns? See the <a href="/contact">contact page</a>. Our terms and privacy
          policy are on the <a href="/legal">legal page</a>.
        </p>
        <PrimaryLink href="/how-it-works">See how it works</PrimaryLink>
      </Section>
    </>
  );
}
