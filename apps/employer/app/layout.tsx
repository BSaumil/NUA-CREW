import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource-variable/manrope';
import '@fontsource-variable/inter';
import '@nua-crew/ui/styles.css';
import { AiDisclosure, Button, ButtonLink, EmployerHeader, EmployerSidebar } from '@nua-crew/ui';
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
            isEmployer ? (
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
            <AiDisclosure>
              AI-supported views are suggestions only. Every hiring decision is made by a person at
              your organisation.
            </AiDisclosure>
          </footer>
        </div>
      </body>
    </html>
  );
}
