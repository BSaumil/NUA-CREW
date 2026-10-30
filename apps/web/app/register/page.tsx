import type { Metadata } from 'next';
import { GuidedSetup } from '@nua-crew/ui';
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
    <div className="nua-stack" style={{ maxWidth: 640 }}>
      <h1>Find your next chapter.</h1>
      <p className="nua-muted">
        Two short steps. Free to find and apply for work across Australia.
      </p>
      <Flash error={error} />
      <GuidedSetup
        action={register}
        submitLabel="Create free account"
        steps={[
          {
            title: 'Your account',
            description:
              'Start with your name and sign-in details. Add your resume and work preferences later.',
            content: (
              <>
                <Field name="full_name" label="Full name" required autoComplete="name" />
                <Field name="email" label="Email" type="email" required autoComplete="email" />
                <Field
                  name="password"
                  label="Password"
                  type="password"
                  required
                  minLength={12}
                  autoComplete="new-password"
                  hint="At least 12 characters. A few random words work well."
                />
              </>
            ),
          },
          {
            title: 'Your choices',
            description: 'Your profile is private until you choose how to participate.',
            content: (
              <>
                <ul>
                  <li>Discovery is optional and off by default.</li>
                  <li>Choose the documents you share when applying.</li>
                  <li>You can decline an invitation without giving a reason.</li>
                </ul>
                <div className="nua-row">
                  <input id="accept_terms" name="accept_terms" type="checkbox" required />
                  <label htmlFor="accept_terms">
                    I accept the <a href="https://iksaa.com.au/terms">terms of use</a> and have read
                    the <a href="https://iksaa.com.au/privacy">privacy policy</a>.
                  </label>
                </div>
                <p className="nua-hint">
                  Next: add your skills and explore jobs. No document upload is needed to create
                  your account.
                </p>
              </>
            ),
          },
        ]}
      />
      <p>
        Already registered? <a href="/login">Log in</a>.
      </p>
    </div>
  );
}
