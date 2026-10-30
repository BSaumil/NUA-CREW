import type { Metadata } from 'next';
import { Faq, PageHero, Section } from '../components';
import { BUSINESS } from '@/lib/business';
export const metadata: Metadata = {
  title: 'Help and quick answers',
  description:
    'Answers about applications, RSA certificates, shift records, employer awards, team permissions and NUA CREW launch status.',
  alternates: { canonical: '/help' },
};
export default function Help() {
  return (
    <>
      <PageHero
        eyebrow="HELP & QUICK ANSWERS"
        title="A little clarity goes a long way."
        lede="Start with the question you came here to answer."
      />
      <nav className="page-shortcuts nua-container" aria-label="Help topics">
        <a href="#job-seekers">Job seekers</a>
        <a href="#employers">Employers</a>
        <a href="#launch">Launch & support</a>
      </nav>
      <Section id="job-seekers" title="For job seekers">
        <Faq
          items={[
            {
              q: 'Can I use the app or upload my resume today?',
              a: (
                <p>
                  Not yet. Public accounts and uploads are closed while web, Android and iOS
                  experiences are tested. The examples on this website do not upload or save
                  documents. Check <a href="/apps">app status</a> for verified access links.
                </p>
              ),
            },
            {
              q: 'Which documents are planned?',
              a: (
                <p>
                  The document workflow supports PDF resumes and PDF, JPG or PNG certificates, up to
                  4 MiB per file. You choose which documents to attach to an application. Keep tax
                  file numbers, passports and bank details out of these files. Upload availability
                  depends on the final storage and scanning setup.
                </p>
              ),
            },
            {
              q: 'Does uploading an RSA certificate verify it?',
              a: (
                <p>
                  No. It is self-provided evidence. A clean malware scan is not a qualification
                  check. Employers must check that a certificate is suitable for the work and state
                  or territory, including any required refresher.
                </p>
              ),
            },
            {
              q: 'Can an employer see my private documents or calendar?',
              a: (
                <p>
                  Discovery shows a limited profile and availability response only when you choose
                  to participate. It does not expose your private document library, minimum pay or
                  calendar. Applying shares the application and files you select with that employer.
                  See the <a href="/privacy#visibility">privacy policy</a>.
                </p>
              ),
            },
            {
              q: 'Is an invitation the same as a job or shift offer?',
              a: (
                <p>
                  No. A recruitment invitation opens a conversation after you accept. A shift offer
                  is a separate step with dates, times and details to review. Accepting a chat
                  invitation does not reserve your time.
                </p>
              ),
            },
            {
              q: 'What if recorded hours or an attendance concern are wrong?',
              a: (
                <p>
                  The workflows in testing keep a correction history and allow a response to an
                  attendance concern. An employer’s report is not automatically a finding against
                  you or a reason to remove wages. NUA CREW is not payroll; raise employment
                  disputes through the appropriate official process when needed.
                </p>
              ),
            },
            {
              q: 'Will I need a NUA POS subscription?',
              a: (
                <p>
                  No. NUA CREW is part of the NUA POS family, but job seekers do not need a POS
                  subscription. Looking for work is free across Australia.
                </p>
              ),
            },
          ]}
        />
      </Section>
      <Section id="employers" tone="alt" title="For employers">
        <Faq
          items={[
            {
              q: 'Can I import my NUA POS staff or use a shared login?',
              a: (
                <p>
                  Not currently. Being part of the same product family does not create automatic
                  account, staff, payroll or candidate-data synchronisation. Any future integration
                  will explain the scope and permissions before it is enabled.
                </p>
              ),
            },
            {
              q: 'Does award guidance calculate every employee entitlement?',
              a: (
                <p>
                  No. The initial reference covers selected adult classifications under the
                  Restaurant and Hospitality Awards. Employers must confirm coverage and check the
                  full entitlement, including applicable penalties, overtime, allowances, juniors,
                  apprentices, superannuation and any enterprise agreement. Use the{' '}
                  <a href="https://calculate.fairwork.gov.au/">Fair Work Pay and Conditions Tool</a>{' '}
                  for an official calculation.
                </p>
              ),
            },
            {
              q: 'How does a teammate get access?',
              a: (
                <p>
                  The owner sends an invitation to an existing employer account. The recipient must
                  accept before access starts. Invitations expire after seven days and can be
                  revoked. Owner, recruiter and viewer roles have different permissions; business
                  workspaces remain separate.
                </p>
              ),
            },
            {
              q: 'Do timesheets make wage payments?',
              a: (
                <p>
                  No. Shift and timesheet tools keep records for review. Your business remains
                  responsible for lawful pay, superannuation, payroll and record keeping. Stripe is
                  intended for employer advertising purchases, not employee wages.
                </p>
              ),
            },
            {
              q: 'What will advertisements and promotions cost?',
              a: (
                <p>
                  The plan is A$19 for a 14-day advertisement and an optional A$30 for five days of
                  promotion, subject to placement capacity. Nothing renews automatically. Billing is
                  not live; final totals and tax treatment will be shown before checkout. Try the{' '}
                  <a href="/pricing">price preview</a>.
                </p>
              ),
            },
            {
              q: 'Can I hire outside Melbourne?',
              a: (
                <p>
                  Job seeker access is designed to be free Australia-wide. Initial launch activity
                  starts with hospitality and local services in Melbourne; local job and candidate
                  availability will vary. No location or number of applicants is guaranteed.
                </p>
              ),
            },
          ]}
        />
      </Section>
      <Section id="launch" title="Launch and support">
        <Faq
          items={[
            {
              q: 'Where are the Android and iPhone download links?',
              a: (
                <p>
                  The apps are not published in the stores yet. We will put verified links on{' '}
                  <a href="/apps">app status</a> when available. Do not use a download link sent by
                  someone claiming to guarantee access.
                </p>
              ),
            },
            {
              q: 'Who operates NUA CREW?',
              a: (
                <p>
                  NUA CREW is part of NUA POS / NUA AUS, ABN {BUSINESS.abn}. Full details are on the{' '}
                  <a href="/legal">legal page</a>.
                </p>
              ),
            },
            {
              q: 'How do I report an issue or request my information?',
              a: (
                <p>
                  Email <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> with “NUA CREW” in
                  the subject. Describe the issue without passwords or unnecessary sensitive
                  documents. Privacy requests can also be made to our published postal address.
                </p>
              ),
            },
          ]}
        />
      </Section>
    </>
  );
}
