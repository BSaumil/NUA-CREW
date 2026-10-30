import type { Metadata } from 'next';
import { LegalDocument } from '../legal-document';
export const metadata: Metadata = {
  title: 'Employer terms',
  alternates: { canonical: '/employer-terms' },
};
export default function EmployerTerms() {
  return (
    <LegalDocument
      title="Employer terms"
      summary="Responsibilities for clear advertisements, respectful recruitment and authorised team access."
      sections={[
        {
          id: 'scope',
          title: 'When these terms apply',
          body: (
            <p>
              These additional conditions describe NUA CREW employer services and supplement the{' '}
              <a href="/terms">terms of use</a>. Public employer registration and billing remain
              closed. No paid order is created by viewing a price or preview. Applicable purchase
              conditions will be shown and accepted before payment becomes available.
            </p>
          ),
        },
        {
          id: 'business',
          title: 'Business identity and team access',
          body: (
            <p>
              Provide accurate business details and evidence of authority when requested.
              Verification means a review of the business operator; it is not an endorsement. Keep
              membership limited to authorised people, use the appropriate owner, recruiter or
              viewer role and remove access when no longer needed. A team invitation grants no
              access until accepted. Do not use a teammate or a different business account to evade
              limits, a decline cooldown or a block.
            </p>
          ),
        },
        {
          id: 'advertisements',
          title: 'Accurate and lawful job advertisements',
          body: (
            <p>
              Advertise genuine work, disclose the offered pay and accurately describe the employer,
              location, employment basis, duties, hours and qualifications. Do not present an
              employee as a contractor to avoid obligations. You are responsible for checking work
              rights, qualifications, safe work conditions and applicable award or agreement
              requirements. Update or close roles when circumstances change. A limited award
              reference does not certify a compliant offer.
            </p>
          ),
        },
        {
          id: 'applicants',
          title: 'Applicant information and fair decisions',
          body: (
            <p>
              Use candidate information only for the authorised recruitment purpose. Limit downloads
              and internal sharing to people who need the information, protect it appropriately and
              meet your own retention and privacy obligations. Do not export talent lists for
              marketing or disclose private documents to another business. Make hiring decisions
              lawfully and fairly. NUA CREW does not make final decisions on your behalf. Respect
              withdrawals, declined invitations and requests to stop contact.
            </p>
          ),
        },
        {
          id: 'shifts',
          title: 'Offers, hours and attendance concerns',
          body: (
            <p>
              Confirm the actual work terms directly with the worker. Do not treat a conversation
              invitation as a booking. Review actual hours, corrections and supporting context
              fairly. An attendance concern must be factual, limited to the relevant shift and open
              to a response. It does not determine employment misconduct, remove wage entitlements
              or automatically cancel a booking. Employers remain responsible for wages,
              superannuation, payroll, records and legal dispute processes.
            </p>
          ),
        },
        {
          id: 'billing',
          title: 'Planned advertising and promotion',
          body: (
            <>
              <p>
                The current plan is A$19 for a 14-day advertisement and an optional A$30 for a
                five-day promotion, making A$49 for a new ad plus a promotion. These are previews,
                not offers currently available for purchase. Final tax treatment and payable totals
                will be shown before checkout. There is no automatic renewal or fee for a successful
                hire.
              </p>
              <p>
                A promotion is advertising, not a promise of applications, suitability or
                recruitment outcomes. The relevant local category, dates, placement, capacity and
                label must be confirmed before purchase. If capacity is unavailable, the purchase
                must not be represented as confirmed. Existing applicant history is retained when a
                role is re-advertised, subject to privacy and retention requirements.
              </p>
            </>
          ),
        },
        {
          id: 'refunds',
          title: 'Cancellations, refunds and service problems',
          body: (
            <p>
              No payment is currently accepted. Before paid services open, we will publish how
              campaign start times, voluntary cancellations, unused periods and failed delivery are
              handled. We will not apply an unpublished cancellation charge. If a service is not
              delivered as agreed, contact support; we will investigate and provide the remedy
              required by the agreement and Australian Consumer Law, including a refund where
              required. These terms do not create a blanket “no refunds” policy.
            </p>
          ),
        },
        {
          id: 'enforcement',
          title: 'Reviews and complaints',
          body: (
            <p>
              We may pause an advertisement or access proportionately for suspected unlawful
              content, fraud or serious misuse, with an explanation and review opportunity where
              appropriate. Contact support to challenge a restriction, correct business information
              or raise a billing issue. Mandatory consumer and small-business protections continue
              to apply.
            </p>
          ),
        },
      ]}
    />
  );
}
