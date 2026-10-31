import { buildMetadata } from '@/lib/seo';
import { LegalDocument } from '../legal-document';
import { BUSINESS } from '@/lib/business';
export const metadata = buildMetadata('/privacy');
export default function Privacy() {
  return (
    <LegalDocument
      title="Privacy policy"
      summary="What we collect, why we need it, who can see it and how you stay in control."
      sections={[
        {
          id: 'scope',
          title: 'Scope and current service',
          body: (
            <>
              <p>
                This policy applies to the NUA CREW website, enquiries and any NUA CREW recruitment
                services we make available. The public website is live. Public registration,
                document uploads, employer payments and the Android and iOS apps are not open yet.
                Descriptions of account features below apply only when those features are enabled
                for you; reading a preview does not create an account.
              </p>
              <p>
                NUA CREW shares an operator with NUA POS. That does not automatically share your
                recruitment profile, documents or messages with POS customers or other NUA products.
                The NUA POS privacy policy governs its separate POS services. We aim to handle
                information consistently with the Australian Privacy Principles and meet the privacy
                laws that apply to us.
              </p>
            </>
          ),
        },
        {
          id: 'collection',
          title: 'Information we collect',
          body: (
            <>
              <p>
                On this website, our hosting provider receives information needed to deliver and
                protect pages, such as IP address, request time, requested URL, browser information
                and security logs. We do not currently run advertising pixels, behavioural
                analytics, registration forms or file-upload forms on the marketing site.
              </p>
              <p>
                If you email us, we receive your email address and anything you include. When
                recruitment features are enabled, we may collect:
              </p>
              <ul>
                <li>
                  Account and profile details, contact details, skills, work history, suburb, state
                  and work preferences.
                </li>
                <li>
                  Availability, commitments, preferred or blocked employers and your discovery
                  settings.
                </li>
                <li>
                  Applications, selected resumes and certificates, qualification details, messages,
                  invitations and reports.
                </li>
                <li>
                  Employer business details, verification evidence, team roles, job advertisements
                  and billing records.
                </li>
                <li>
                  Shift offers, attendance timestamps, timesheets, corrections, concerns and the
                  parties’ responses.
                </li>
                <li>
                  Device, session, notification and security information needed to operate the
                  service.
                </li>
              </ul>
              <p>
                We collect information directly from you, from your use of the service, from an
                employer or applicant interacting with you, and from authorised verification sources
                where applicable. Required fields will be identified. Without necessary details we
                may be unable to provide the relevant feature. Optional fields can be left blank.
              </p>
            </>
          ),
        },
        {
          id: 'purpose',
          title: 'How we use information',
          body: (
            <>
              <p>
                We use information to respond to enquiries, administer accounts, display jobs,
                manage applications, apply your discovery choices, deliver invitations and
                conversations, maintain shift records, support users, prevent abuse and comply with
                applicable law. Billing information is used only for employer purchases when billing
                is enabled.
              </p>
              <p>
                We do not sell personal information. We use recruitment documents only for the
                recruitment and support purposes described in this policy. We will explain any
                material new use before introducing it and obtain consent where required.
              </p>
            </>
          ),
        },
        {
          id: 'visibility',
          title: 'What employers and other people can see',
          body: (
            <>
              <p>
                Discovery is optional and off by default. When enabled, verified employers may see a
                limited profile, such as first name and last initial, headline, suburb, skills and a
                response about availability for a requested time. Your private calendar and minimum
                pay are not displayed through discovery.
              </p>
              <p>
                Applying to a role shares the application and the documents you select with that
                employer’s authorised team. Accepting an invitation to chat does not automatically
                share your private document library or accept a job. Messages and relevant shift
                records are visible to participants and authorised employer teammates. Support may
                review information where needed to resolve a report or support request.
              </p>
              <p>
                Employers are responsible for how they handle information they legitimately receive.
                Revoking access or deleting an account cannot recall a copy already lawfully
                downloaded or independently retained by another party. Do not include a tax file
                number, bank details, passport or unrelated sensitive information in a resume or
                message.
              </p>
            </>
          ),
        },
        {
          id: 'providers',
          title: 'Service providers and overseas handling',
          body: (
            <>
              <p>
                The marketing website is hosted on Vercel, a US-based provider. Technical request
                and security information may be processed in the United States and other locations
                used by its global infrastructure. Our support email provider also processes
                messages you send us. Ask us for the current handling arrangements before sending
                sensitive material.
              </p>
              <p>
                Recruitment storage, scanning, communications and payment arrangements are still
                being configured. Before public account and document services open, we will update
                this policy with the actual providers and likely overseas recipient countries, where
                practicable. We do not promise Australian-only storage. We assess providers and use
                contractual and access safeguards appropriate to the information and applicable law.
              </p>
              <p>
                We may also disclose information to professional advisers, authorities where legally
                required or authorised, and a successor operator as part of a business transfer with
                appropriate protections and notice. We disclose only what is reasonably needed for
                the purpose.
              </p>
            </>
          ),
        },
        {
          id: 'documents',
          title: 'Documents, security and device permissions',
          body: (
            <>
              <p>
                Document features are designed for private storage, permission-controlled sharing
                and malware scanning before access. A scan is a security check, not verification of
                a qualification or a guarantee that a file is safe. RSA and other certificate
                details are self-provided unless a separate verification is expressly identified.
              </p>
              <p>
                We use access controls and other reasonable safeguards to protect information. No
                internet service can promise absolute security. If a data breach occurs, we assess
                it and notify affected people and regulators where required. Optional device
                biometrics are handled by the device’s operating system; we do not receive
                fingerprint or face templates. Camera, file, location and notification permissions
                are requested only when relevant to the feature, and can be managed through your
                device.
              </p>
            </>
          ),
        },
        {
          id: 'retention',
          title: 'Retention and deletion',
          body: (
            <>
              <p>
                We keep information only as reasonably needed for the service, security, support,
                disputes and legal obligations. Retention depends on the record and its purpose; we
                do not claim a fixed deletion period that has not been implemented.
              </p>
              <p>
                You can request account closure and deletion through available account controls or
                support. We may need to retain limited transaction, shared business, safety, audit
                or dispute records. Backups may take longer to expire and are restricted from
                ordinary use. We will explain any material retention exception that applies to your
                request. We delete or de-identify information when it is no longer needed and we are
                legally able to do so.
              </p>
            </>
          ),
        },
        {
          id: 'rights',
          title: 'Access, correction and choices',
          body: (
            <>
              <p>
                Contact us to request access, an available export, correction or deletion of your
                information. We may ask for proportionate evidence of identity to avoid releasing it
                to the wrong person; do not email identity documents unless we arrange a suitable
                method. If access or correction is refused under an applicable exception, we explain
                the reason and your complaint options.
              </p>
              <p>
                When accounts open, discovery, invitation, employer preference and notification
                controls let you manage participation. You can unsubscribe from optional marketing
                without losing essential service messages. We do not currently run a marketing
                mailing list on this website.
              </p>
            </>
          ),
        },
        {
          id: 'cookies',
          title: 'Cookies and website previews',
          body: (
            <p>
              Our interactive examples keep selections in page memory; they do not upload documents
              or submit applications. The marketing site does not currently set app login cookies or
              use advertising or analytics tracking. Hosting security measures may process technical
              data. See our <a href="/cookies">cookie and website-data notice</a> for details.
            </p>
          ),
        },
        {
          id: 'complaints',
          title: 'Contact and complaints',
          body: (
            <>
              <p>
                Write to the Privacy Officer at{' '}
                <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a> or the address above.
                Explain what happened and what outcome you seek, without including unnecessary
                sensitive information. We aim to acknowledge complaints within seven days and
                respond within 30 days; if more time is needed we will explain why.
              </p>
              <p>
                If the matter remains unresolved, you can contact the{' '}
                <a href="https://www.oaic.gov.au/privacy/privacy-complaints">
                  Office of the Australian Information Commissioner
                </a>{' '}
                for information about whether it can consider your complaint. You can also seek
                independent advice.
              </p>
            </>
          ),
        },
        {
          id: 'changes',
          title: 'Changes to this policy',
          body: (
            <p>
              We publish revisions here with a new date. Material changes to an enabled account
              service will be brought to users’ attention through an appropriate channel. We will
              not treat a new website notice as blanket consent to a materially different use of
              your information.
            </p>
          ),
        },
      ]}
    />
  );
}
