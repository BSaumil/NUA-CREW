import { buildMetadata } from '@/lib/seo';
import { LegalDocument } from '../legal-document';
export const metadata = buildMetadata('/cookies');
export default function Cookies() {
  return (
    <LegalDocument
      title="Cookies and website data"
      summary="A simple explanation of what happens when you browse this website."
      sections={[
        {
          id: 'current',
          title: 'What this marketing site uses',
          body: (
            <p>
              The NUA CREW marketing site does not currently use advertising pixels, behavioural
              analytics, account login cookies or a marketing signup form. Feature previews and
              price examples keep selections temporarily in page memory; they do not save your
              selection to a profile or send it as an application. This site does not accept resumes
              or certificates.
            </p>
          ),
        },
        {
          id: 'hosting',
          title: 'Technical and security information',
          body: (
            <p>
              Our hosting provider, Vercel, processes requests needed to serve and protect the
              website. These can include IP address, browser details, requested page, timestamps and
              security events. Protective measures may use technical browser or request signals.
              This is separate from advertising or behavioural tracking. See the{' '}
              <a href="/privacy">privacy policy</a> for hosting and overseas handling.
            </p>
          ),
        },
        {
          id: 'external',
          title: 'Email and external websites',
          body: (
            <p>
              An email link opens your own mail service; your message is sent only if you choose to
              send it. NUA POS, official guidance sites, app stores and other external services have
              their own data practices. Visiting an example on this site does not sign you into
              those services or authorise data sharing with them.
            </p>
          ),
        },
        {
          id: 'choices',
          title: 'Your choices and future changes',
          body: (
            <p>
              You can control cookies and stored data through your browser settings. Restricting
              storage may affect future signed-in app features. If we introduce optional tracking,
              we will update this notice and provide appropriate controls and consent where required
              before it is enabled. App login, security and notification settings will be explained
              separately when those services open.
            </p>
          ),
        },
      ]}
    />
  );
}
