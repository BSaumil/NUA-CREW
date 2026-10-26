import type { Metadata } from 'next';
import { Button } from '@nua-crew/ui';
import { login } from '../actions';
import { Field, Flash, flashFrom } from '../components';

export const metadata: Metadata = { title: 'Log in' };

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error, notice } = await flashFrom(searchParams);
  return (
    <div className="nua-stack" style={{ maxWidth: 480 }}>
      <h1>Log in to NUA CREW Hire</h1>
      <Flash error={error} notice={notice} />
      <form action={login} className="nua-card nua-stack">
        <Field name="email" label="Work email" type="email" required autoComplete="email" />
        <Field
          name="password"
          label="Password"
          type="password"
          required
          autoComplete="current-password"
        />
        <div>
          <Button type="submit">Log in</Button>
        </div>
      </form>
      <p>
        New business? <a href="/register">Register your business</a>
      </p>
    </div>
  );
}
