import type { Metadata } from 'next';
import { Button } from '@nua-crew/ui';
import { api, canWrite, requireEmployer } from '@/lib/api';
import { createJob } from '../../actions';
import { Field, Flash, flashFrom } from '../../components';

export const metadata: Metadata = { title: 'Post a job' };

export default async function NewJob({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { employerId, role } = await requireEmployer();
  const { error } = await flashFrom(searchParams);
  if (!canWrite(role)) return <p role="alert">Your role cannot create jobs.</p>;
  const { data: locations } = await (
    await api()
  ).GET('/v1/employers/{employer_id}/locations', {
    params: { path: { employer_id: employerId } },
  });
  return (
    <div className="nua-stack" style={{ maxWidth: 720 }}>
      <h1>Post a job</h1>
      <Flash error={error} />
      <form action={createJob} className="nua-card nua-stack">
        <Field name="title" label="Job title" required />
        <div className="nua-field">
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" required maxLength={20000} />
        </div>
        <div className="nua-grid">
          <div className="nua-field">
            <label htmlFor="employment_type">Employment type</label>
            <select id="employment_type" name="employment_type" defaultValue="casual">
              <option value="casual">Casual</option>
              <option value="part_time">Part time</option>
              <option value="full_time">Full time</option>
              <option value="contract">Contract</option>
              <option value="shift">Shift</option>
            </select>
          </div>
          <Field name="category" label="Category" defaultValue="Hospitality" />
          <div className="nua-field">
            <label htmlFor="location_id">Location</label>
            <select id="location_id" name="location_id" required>
              {(locations ?? []).map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name} — {l.suburb}
                </option>
              ))}
            </select>
          </div>
        </div>
        <fieldset className="nua-stack" style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 700 }}>Pay (AUD)</legend>
          <p className="nua-hint">
            Listing pay builds candidate trust. It is shown as &ldquo;Disclosed&rdquo;. Leave blank
            to say pay is not disclosed.
          </p>
          <div className="nua-grid">
            <Field name="pay_min" label="From" type="number" step="0.01" min={0} />
            <Field name="pay_max" label="To" type="number" step="0.01" min={0} />
            <div className="nua-field">
              <label htmlFor="pay_period">Per</label>
              <select id="pay_period" name="pay_period" defaultValue="hour">
                <option value="hour">Hour</option>
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
                <option value="year">Year</option>
              </select>
            </div>
            <div className="nua-field">
              <label htmlFor="super">Superannuation</label>
              <select id="super" name="super" defaultValue="">
                <option value="">Not stated</option>
                <option value="included">Included in pay</option>
                <option value="plus">On top of pay</option>
              </select>
            </div>
          </div>
        </fieldset>
        <Field name="skills" label="Skills" hint="Separate with commas, e.g. Barista, RSA" />
        <div>
          <Button type="submit">Save draft</Button>
        </div>
      </form>
    </div>
  );
}
