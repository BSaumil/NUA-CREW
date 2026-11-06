import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/manrope';
import '@fontsource-variable/inter';
import '@nua-crew/ui/styles.css';
import { Button, ButtonLink, EmployerHeader, EmployerSidebar } from '@nua-crew/ui';
import { getViewer } from '@/lib/api';
import { logout } from './actions';

export const metadata: Metadata = {
  title: { default: 'NUA CREW Hire', template: '%s · NUA CREW Hire' },
  description: 'Meet qualified people without unnecessary noise.',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const viewer = await getViewer();
  const isEmployer = viewer?.role === 'employer';
  return (
    <html lang="en-AU">
      <body>
        <a className="nua-skip" href="#main">
          Skip to content
        </a>
        <EmployerHeader
          right={
            viewer ? (
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
                <ButtonLink href="/register">Register your business</ButtonLink>
              </>
            )
          }
        />
        <div className="nua-container">
          {viewer && viewer.email_verified === false && viewer.email_delivery ? (
            <p className="nua-alert">
              Your email address is not confirmed yet. <a href="/verify-email">Confirm it</a> so you
              can recover your account if you forget your password.
            </p>
          ) : null}
          {isEmployer ? (
            <div className="nua-shell">
              <EmployerSidebar current="" />
              <main id="main">{children}</main>
            </div>
          ) : (
            <main id="main" style={{ padding: '32px 0 64px' }}>
              {children}
            </main>
          )}
          <footer className="nua-hint" style={{ padding: '0 0 48px' }}>
            Every hiring decision is made by a person. Employee access is free across Australia.
          </footer>
        </div>
      </body>
    </html>
  );
}
