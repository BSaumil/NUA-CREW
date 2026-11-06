import type { Metadata } from 'next';
import { Button } from '@nua-crew/ui';
import { resetPassword } from '../actions';
import { Field, Flash, flashFrom } from '../components';

// The link carries a one-time secret: keep it out of Referer headers and search indexes.
export const metadata: Metadata = {
  title: 'Choose a new password',
  referrer: 'no-referrer',
  robots: { index: false },
};

export default async function ResetPassword({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error, p } = await flashFrom(searchParams);
  const token = typeof p.token === 'string' ? p.token : '';
  return (
    <div className="nua-stack" style={{ maxWidth: 480 }}>
      <h1>Choose a new password</h1>
      <Flash error={error} />
      {token ? (
        <form action={resetPassword} className="nua-card nua-stack">
          <input type="hidden" name="token" value={token} />
          <Field
            name="new_password"
            label="New password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            hint="At least 12 characters. A few random words work well."
          />
          <Field
            name="confirm_password"
            label="Repeat the new password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
          />
          <div>
            <Button type="submit">Change password</Button>
          </div>
        </form>
      ) : (
        <p role="alert">This link is incomplete. Please use the link from your email.</p>
      )}
      <p>
        Link not working? <a href="/forgot-password">Request a new one</a>.
      </p>
    </div>
  );
}
