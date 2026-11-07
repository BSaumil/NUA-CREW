import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/manrope';
import '@fontsource-variable/inter';
import '@nua-crew/ui/styles.css';
import {
  MatchDisclosure,
  Button,
  ButtonLink,
  CandidateNav,
  SUPPORT_LINE,
  TAGLINE,
} from '@nua-crew/ui';
import { getViewer } from '@/lib/api';
import { logout } from './actions';

export const metadata: Metadata = {
  title: { default: `NUA CREW Jobs — ${TAGLINE}`, template: '%s · NUA CREW' },
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
          {viewer && viewer.email_verified === false && viewer.email_delivery ? (
            <p className="nua-alert">
              Your email address is not confirmed yet. <a href="/verify-email">Confirm it</a> so you
              can recover your account if you forget your password.
            </p>
          ) : null}
          {children}
        </main>
        <footer className="nua-container nua-hint" style={{ padding: '0 16px 48px' }}>
          <MatchDisclosure />
          <p>
            NUA CREW is part of NUA POS / NUA AUS. ABN 54 299 131 653.{' '}
            <a href="/trust">How trust signals work</a>
          </p>
        </footer>
      </body>
    </html>
  );
}
