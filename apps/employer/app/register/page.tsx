import type { Metadata } from 'next';
import { Button } from '@nua-crew/ui';
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
    <div className="nua-stack" style={{ maxWidth: 560 }}>
      <h1>Register your business</h1>
      <p className="nua-muted">
        Meet qualified people without unnecessary noise. We review every business before jobs go
        live.
      </p>
      <Flash error={error} />
      <form action={register} className="nua-card nua-stack">
        <Field name="organisation_name" label="Business name" required />
        <Field
          name="abn"
          label="ABN"
          hint="11 digits. We check the format now and review the business before you can publish."
        />
        <Field name="full_name" label="Your name" required autoComplete="name" />
        <Field name="email" label="Work email" type="email" required autoComplete="email" />
        <Field
          name="password"
          label="Password"
          type="password"
          required
          autoComplete="new-password"
          hint="At least 12 characters."
        />
        <fieldset className="nua-stack" style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 700 }}>First location</legend>
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
        </fieldset>
        <div className="nua-row">
          <input id="accept_terms" name="accept_terms" type="checkbox" required />
          <label htmlFor="accept_terms">
            I am authorised to act for this business and accept the terms.
          </label>
        </div>
        <div>
          <Button type="submit">Register</Button>
        </div>
      </form>
    </div>
  );
}
