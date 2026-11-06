import type { Metadata } from 'next';
import { Button } from '@nua-crew/ui';
import { requestPasswordReset } from '../actions';
import { Field, Flash, flashFrom } from '../components';

export const metadata: Metadata = { title: 'Reset your password', robots: { index: false } };

export default async function ForgotPassword({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error, notice } = await flashFrom(searchParams);
  return (
    <div className="nua-stack" style={{ maxWidth: 480 }}>
      <h1>Reset your password</h1>
      <p className="nua-muted">
        Enter the email address for your account and we will email you a link to choose a new
        password.
      </p>
      <Flash error={error} notice={notice} />
      <form action={requestPasswordReset} className="nua-card nua-stack">
        <Field name="email" label="Email" type="email" required autoComplete="email" />
        <div>
          <Button type="submit">Email me a reset link</Button>
        </div>
      </form>
      <p>
        <a href="/login">Back to log in</a>
      </p>
    </div>
  );
}
