import type { Metadata } from 'next';
import { LegalDocument } from '../legal-document';
export const metadata: Metadata = { title: 'Terms of use', alternates: { canonical: '/terms' } };
export default function Terms() {
  return (
    <LegalDocument
      title="Terms of use"
      summary="Clear ground rules for using our website and recruitment services."
      sections={[
        {
          id: 'service',
          title: 'The service and these terms',
          body: (
            <>
              <p>
                These terms cover the NUA CREW website and recruitment features made available by
                the operator identified above. NUA CREW is part of NUA POS; it is not a separate
                employing entity. You do not need a NUA POS subscription to look for work.
              </p>
              <p>
                The public website is informational. Product examples are fictional, account
                services remain in testing and payments are disabled. Browsing does not enrol you in
                paid services. Before an account or paid service opens, its applicable terms will be
                presented for acceptance. Additional <a href="/employer-terms">employer terms</a>{' '}
                apply to business services when enabled.
              </p>
            </>
          ),
        },
        {
          id: 'eligibility',
          title: 'Accounts and authority',
          body: (
            <p>
              When accounts are available, provide accurate details, use only accounts you are
              entitled to use and keep your sign-in information secure. An employer representative
              must have authority to act for the business. Do not share logins; use authorised team
              memberships. Tell support if you suspect unauthorised access. Any age or eligibility
              requirements for an enabled service will be explained before registration; a website
              preview is not permission to work or evidence of work rights.
            </p>
          ),
        },
        {
          id: 'marketplace',
          title: 'Recruitment and employment responsibilities',
          body: (
            <>
              <p>
                NUA CREW helps people and businesses find and discuss work. Unless expressly agreed
                in a separate written arrangement, we are not the employer, a party to an employment
                contract, a payroll service or a provider supplying labour. The employer and worker
                must agree on the actual role, lawful terms, pay and conditions.
              </p>
              <p>
                Listings, availability responses and verification labels are information, not
                guarantees of a hire, work rights, qualifications, suitability or legal compliance.
                Accepting a conversation invitation does not accept a job or reserve a shift. Review
                a separate shift offer before accepting it. Employers remain responsible for lawful
                hiring decisions.
              </p>
            </>
          ),
        },
        {
          id: 'conduct',
          title: 'Respectful and lawful use',
          body: (
            <p>
              Follow our <a href="/community-guidelines">community guidelines</a>. Do not post
              misleading or unlawful roles, discriminate unlawfully, harass people, request payment
              to secure a job, scrape private profiles, evade a block or collect information for
              unrelated marketing. Do not upload malware, impersonate another person or try to
              bypass access controls. Report concerns through support or available in-app reporting.
            </p>
          ),
        },
        {
          id: 'content',
          title: 'Your content and privacy',
          body: (
            <>
              <p>
                You keep your rights in your content. You give us permission to host, process, scan
                and display it only as reasonably needed to provide and protect the services,
                following your sharing choices. You must have the right to upload it. This
                permission ends when it is no longer needed, subject to the limited retention
                described in our <a href="/privacy">privacy policy</a>.
              </p>
              <p>
                Do not disclose another person’s private information without a lawful basis.
                Employers must use applicant information for the recruitment purpose for which it
                was provided and comply with applicable privacy obligations. Sharing a document with
                an employer is distinct from turning discovery on.
              </p>
            </>
          ),
        },
        {
          id: 'pay',
          title: 'Pay information and shift records',
          body: (
            <p>
              Disclosed pay is supplied by an employer; any estimate must be labelled. Award
              references cover selected cases and are not a complete calculation of legal
              entitlements. Confirm award coverage, classifications, penalties, allowances,
              superannuation and other requirements with an appropriate official source or adviser.
              Attendance and timesheet tools keep records; they do not transfer wages. A reported
              attendance concern is a claim that can be disputed, not an automatic finding or
              authority to deduct pay.
            </p>
          ),
        },
        {
          id: 'fees',
          title: 'Fees and purchases',
          body: (
            <p>
              Looking for work is free across Australia. Employer pricing shown on this website is a
              preview; no purchase is currently available. When billing opens, the total price, tax
              treatment, duration, placement conditions and cancellation or refund terms will be
              shown before you confirm. No renewal or add-on is purchased without your
              authorisation. Nothing in these terms removes rights to a remedy under Australian
              Consumer Law.
            </p>
          ),
        },
        {
          id: 'availability',
          title: 'Service changes and external links',
          body: (
            <p>
              Features may be unavailable during maintenance or testing. We will explain significant
              limitations and give reasonable notice of material changes where practicable. External
              websites have their own terms and privacy practices; we identify external applications
              when relevant. We do not guarantee the availability or accuracy of third-party
              services.
            </p>
          ),
        },
        {
          id: 'suspension',
          title: 'Restriction, closure and review',
          body: (
            <p>
              We may restrict content or access where reasonably needed to address misuse, security
              threats or legal requirements. Where appropriate, we will explain the reason, give an
              opportunity to respond and offer a review through support. An urgent restriction may
              come first if notice would increase risk or be unlawful. We will consider relevant
              evidence and apply a proportionate response. You may stop using the service and
              request account closure at any time; shared or legally required records may be
              retained as explained in the privacy policy.
            </p>
          ),
        },
        {
          id: 'rights',
          title: 'Consumer rights and responsibility',
          body: (
            <p>
              Nothing here excludes, restricts or modifies a guarantee, right or remedy that cannot
              lawfully be excluded, including under Australian Consumer Law. We are responsible for
              our services as required by law. No statement about another person’s content or a
              third-party service excuses our own legal obligations. If something goes wrong,
              contact us so we can investigate and provide any remedy required.
            </p>
          ),
        },
        {
          id: 'disputes',
          title: 'Concerns, law and changes',
          body: (
            <p>
              Contact support with a concern and the outcome you seek. We will try to resolve it
              fairly; this does not prevent you from contacting a regulator, obtaining advice or
              exercising legal rights. Victorian and applicable Commonwealth law govern these terms,
              without limiting mandatory rights or any court or tribunal you may lawfully use. We
              will publish changes with a date and notify account holders of material changes where
              relevant. We will seek fresh agreement where required and will not retrospectively
              change an existing purchase’s agreed price or duration.
            </p>
          ),
        },
      ]}
    />
  );
}
