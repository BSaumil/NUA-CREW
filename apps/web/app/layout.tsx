import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/manrope';
import '@fontsource-variable/inter';
import '@nua-crew/ui/styles.css';
import { AiDisclosure, Button, ButtonLink, CandidateNav, SUPPORT_LINE } from '@nua-crew/ui';
import { getViewer } from '@/lib/api';
import { logout } from './actions';

export const metadata: Metadata = {
  title: { default: 'NUA CREW Jobs — Better Jobs. Stronger Teams.', template: '%s · NUA CREW' },
  description: SUPPORT_LINE,
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  const isCandidate = viewer?.role === 'candidate';
  return (
    <html lang="en-AU">
      <body>
        <a className="nua-skip" href="#main">
          Skip to content
        </a>
        <CandidateNav
          current=""
          right={
            isCandidate ? (
              <form action={logout}>
                <Button type="submit" variant="secondary">
                  Log out
                </Button>
              </form>
            ) : (
              <>
                <ButtonLink href="/login" variant="secondary">
                  Log in
                </ButtonLink>
                <ButtonLink href="/register">Create account</ButtonLink>
              </>
            )
          }
        />
        <main id="main" className="nua-container" style={{ padding: '32px 16px 64px' }}>
          {children}
        </main>
        <footer className="nua-container nua-hint" style={{ padding: '0 16px 48px' }}>
          <AiDisclosure />
          <p>
            NUA CREW is a working name pending legal clearance.{' '}
            <a href="/trust">How trust signals work</a>
          </p>
        </footer>
      </body>
    </html>
  );
}
