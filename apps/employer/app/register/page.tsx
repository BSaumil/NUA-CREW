import type { Metadata } from 'next';
import { GuidedSetup } from '@nua-crew/ui';
import { register } from '../actions';
import { Field, Flash, flashFrom } from '../components';
export const metadata: Metadata = { title: 'Register your business' };
export default async function Register({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { error } = await flashFrom(searchParams);
  return (
    <div className="nua-stack" style={{ maxWidth: 680 }}>
      <h1>Your next great hire.</h1>
      <p className="nua-muted">
        Set up your workspace in three short steps. No payment is taken during registration.
      </p>
      <Flash error={error} />
      <GuidedSetup
        action={register}
        submitLabel="Create business workspace"
        steps={[
          {
            title: 'Your account',
            description: 'Use your own sign-in. You can invite authorised teammates later.',
            content: (
              <>
                <Field name="full_name" label="Your name" required autoComplete="name" />
                <Field name="email" label="Work email" type="email" required autoComplete="email" />
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
            title: 'Your business',
            description: 'Tell us which business you represent and where its first location is.',
            content: (
              <>
                <Field
                  name="organisation_name"
                  label="Business name"
                  required
                  autoComplete="organization"
                />
                <Field
                  name="abn"
                  label="ABN (optional at setup)"
                  hint="11 digits. Providing an ABN does not complete business verification."
                />
                <Field name="location_name" label="Location name" defaultValue="Main location" />
                <div className="nua-grid">
                  <Field name="suburb" label="Suburb" required />
                  <div className="nua-field">
                    <label htmlFor="state">State</label>
                    <select id="state" name="state" required defaultValue="VIC">
                      {['VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                  <Field name="postcode" label="Postcode" required />
                </div>
              </>
            ),
          },
          {
            title: 'Review & agree',
            description: 'Create a workspace now. Business verification comes before publishing.',
            content: (
              <>
                <ul>
                  <li>You can draft a role before verification.</li>
                  <li>Only authorised members can access your workspace.</li>
                  <li>Creating an account does not buy an advertisement.</li>
                </ul>
                <div className="nua-row">
                  <input id="accept_terms" name="accept_terms" type="checkbox" required />
                  <label htmlFor="accept_terms">
                    I am authorised to act for this business and accept the{' '}
                    <a href="https://iksaa.com.au/terms">terms of use</a> and{' '}
                    <a href="https://iksaa.com.au/employer-terms">employer terms</a>. I have read
                    the <a href="https://iksaa.com.au/privacy">privacy policy</a>.
                  </label>
                </div>
                <p className="nua-hint">Next: review your workspace and draft your first role.</p>
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
