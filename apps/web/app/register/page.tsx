import type { Metadata } from 'next';
import { Button } from '@nua-crew/ui';
import { register } from '../actions';
import { Field, Flash, flashFrom } from '../components';

export const metadata: Metadata = { title: 'Create account' };

export default async function Register({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error } = await flashFrom(searchParams);
  return (
    <div className="nua-stack" style={{ maxWidth: 480 }}>
      <h1>Create your free account</h1>
      <p className="nua-muted">
        Finding and applying for jobs is free. No subscription is needed to apply.
      </p>
      <Flash error={error} />
      <form action={register} className="nua-card nua-stack">
        <Field name="full_name" label="Full name" required autoComplete="name" />
        <Field name="email" label="Email" type="email" required autoComplete="email" />
        <Field
          name="password"
          label="Password"
          type="password"
          required
          autoComplete="new-password"
          hint="At least 12 characters."
        />
        <div className="nua-row">
          <input id="accept_terms" name="accept_terms" type="checkbox" required />
          <label htmlFor="accept_terms">
            I agree to the terms and understand how my data is used (<a href="/trust">summary</a>).
          </label>
        </div>
        <div>
          <Button type="submit">Create account</Button>
        </div>
      </form>
    </div>
  );
}
