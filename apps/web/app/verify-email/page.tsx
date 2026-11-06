import type { Metadata } from 'next';
import { Button } from '@nua-crew/ui';
import { confirmEmail, resendVerification } from '../actions';
import { Flash, flashFrom } from '../components';
import { getViewer } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Confirm your email address',
  referrer: 'no-referrer',
  robots: { index: false },
};

export default async function VerifyEmail({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error, notice, p } = await flashFrom(searchParams);
  const token = typeof p.token === 'string' ? p.token : '';
  const viewer = token ? null : await getViewer();
  return (
    <div className="nua-stack" style={{ maxWidth: 480 }}>
      <h1>Confirm your email address</h1>
      <Flash error={error} notice={notice} />
      {token ? (
        // A button, not an automatic action: mail scanners open links, and opening must not confirm.
        <form action={confirmEmail} className="nua-card nua-stack">
          <input type="hidden" name="token" value={token} />
          <p>Confirm that this is your email address for NUA CREW.</p>
          <div>
            <Button type="submit">Confirm my email address</Button>
          </div>
        </form>
      ) : viewer?.email_verified ? (
        <p>Your email address is confirmed.</p>
      ) : viewer ? (
        <form action={resendVerification} className="nua-card nua-stack">
          <p>
            We send a confirmation link to {viewer.email}. A confirmed address lets you recover your
            account if you forget your password.
          </p>
          <div>
            <Button type="submit">Email me a new link</Button>
          </div>
        </form>
      ) : (
        <p>
          Open the link from your email. Or <a href="/login">log in</a> to ask for a new one.
        </p>
      )}
    </div>
  );
}
