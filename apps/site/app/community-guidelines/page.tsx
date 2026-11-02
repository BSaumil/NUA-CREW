import { buildMetadata } from '@/lib/seo';
import { LegalDocument } from '../legal-document';
export const metadata = buildMetadata('/community-guidelines');
export default function Community() {
  return (
    <LegalDocument
      title="Community guidelines"
      summary="Real opportunities. Respectful conversations. Room to say no."
      sections={[
        {
          id: 'honesty',
          title: 'Be honest about the work and your experience',
          body: (
            <p>
              Use your own identity, advertise genuine work and describe skills and qualifications
              accurately. Do not invent credentials or verification. Certificates shown as
              self-provided are not independently verified by NUA CREW. Never offer or request
              unlawful work.
            </p>
          ),
        },
        {
          id: 'respect',
          title: 'Respect people and their choices',
          body: (
            <p>
              No harassment, threats, hate, unlawful discrimination, sexual solicitation or
              coercion. A person can decline an invitation without explaining why. Do not contact
              them through another account or business to evade that choice. A profile is not
              permission to investigate someone’s private life.
            </p>
          ),
        },
        {
          id: 'safety',
          title: 'Keep money and sensitive information safe',
          body: (
            <p>
              Do not ask applicants to pay to secure a job, share passwords or provide unnecessary
              identity or financial information through chat. Confirm unusual requests directly with
              the business using independently verified contact details. Do not send a tax file
              number, card number or bank login in a resume, report or public message. NUA CREW does
              not collect wages or make payroll payments.
            </p>
          ),
        },
        {
          id: 'records',
          title: 'Keep records fair and factual',
          body: (
            <p>
              Attendance reports, reviews and corrections should describe the relevant facts. Do not
              use reports to retaliate, pressure a person to withdraw an application or avoid paying
              lawful wages. Give people a reasonable chance to respond. An unresolved claim should
              never be presented as a verified finding.
            </p>
          ),
        },
        {
          id: 'report',
          title: 'Report a concern and request a review',
          body: (
            <p>
              Use available in-app reporting or <a href="/contact">contact support</a>. Include the
              relevant job or conversation reference and a short account of what happened. We may
              review relevant content and take proportionate action, such as a warning, content
              removal or access restriction. Ask support for a review if you believe a mistake was
              made. For immediate danger in Australia, call 000; NUA CREW support is not an
              emergency service.
            </p>
          ),
        },
      ]}
    />
  );
}
