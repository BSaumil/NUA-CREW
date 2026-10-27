import { Button } from '@nua-crew/ui';
import type { Schemas } from '@nua-crew/contracts';
import { Field } from './components';

type Job = Schemas['JobOut'];
type Location = Schemas['LocationOut'];

const superValue = (v: boolean | null | undefined) =>
  v === true ? 'included' : v === false ? 'plus' : '';

function Select({
  name,
  label,
  value,
  options,
}: {
  name: string;
  label: string;
  value: string | undefined;
  options: [string, string][];
}) {
  return (
    <div className="nua-field">
      <label htmlFor={name}>{label}</label>
      <select id={name} name={name} defaultValue={value ?? 'unspecified'}>
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </div>
  );
}

/** Shared by "Post a job" and "Edit job"; `job` pre-fills the edit case. */
export function JobForm({
  action,
  locations,
  job,
  submitLabel,
}: {
  action: (form: FormData) => Promise<void>;
  locations: Location[];
  job?: Job;
  submitLabel: string;
}) {
  return (
    <form action={action} className="nua-card nua-stack">
      {job ? <input type="hidden" name="job_id" value={job.id} /> : null}
      <Field name="title" label="Job title" required defaultValue={job?.title} />
      <div className="nua-field">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          name="description"
          required
          maxLength={20000}
          defaultValue={job?.description ?? ''}
        />
      </div>
      <div className="nua-grid">
        <div className="nua-field">
          <label htmlFor="employment_type">Employment type</label>
          <select
            id="employment_type"
            name="employment_type"
            defaultValue={job?.employment_type ?? 'casual'}
          >
            <option value="casual">Casual</option>
            <option value="part_time">Part time</option>
            <option value="full_time">Full time</option>
            <option value="contract">Contract</option>
            <option value="shift">Shift</option>
          </select>
        </div>
        <Field name="category" label="Category" defaultValue={job?.category ?? 'Hospitality'} />
        <div className="nua-field">
          <label htmlFor="location_id">Location</label>
          <select
            id="location_id"
            name="location_id"
            required
            defaultValue={job?.location_id ?? undefined}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name} — {l.suburb}
              </option>
            ))}
          </select>
        </div>
      </div>
      <fieldset className="nua-stack" style={{ border: 0, padding: 0 }}>
        <legend style={{ fontWeight: 700 }}>The arrangement</legend>
        <p className="nua-hint">
          These are separate facts. &ldquo;Not specified&rdquo; is a fine answer when you
          don&rsquo;t know yet. NUA CREW doesn&rsquo;t decide whether a role is employment or
          contracting; that depends on the real working relationship.
        </p>
        <div className="nua-grid">
          <Select
            name="engagement_basis"
            label="Engagement"
            value={job?.engagement_basis}
            options={[
              ['unspecified', 'Not specified'],
              ['employee', 'Employee'],
              ['contractor', 'Contractor'],
            ]}
          />
          <Select
            name="duration_type"
            label="Duration"
            value={job?.duration_type}
            options={[
              ['unspecified', 'Not specified'],
              ['ongoing', 'Ongoing'],
              ['fixed_term', 'Fixed term'],
              ['one_off', 'One-off'],
            ]}
          />
          <Select
            name="hours_pattern"
            label="Hours"
            value={job?.hours_pattern}
            options={[
              ['unspecified', 'Not specified'],
              ['full_time', 'Full time'],
              ['part_time', 'Part time'],
              ['casual', 'Casual'],
            ]}
          />
        </div>
        <div className="nua-grid">
          <Field
            name="min_weekly_hours"
            label="Fewest hours a week"
            type="number"
            step="0.5"
            min={0}
            max={168}
            defaultValue={job?.min_weekly_hours}
          />
          <Field
            name="max_weekly_hours"
            label="Most hours a week"
            type="number"
            step="0.5"
            min={0}
            max={168}
            defaultValue={job?.max_weekly_hours}
          />
          <Field name="start_date" label="Start date" type="date" defaultValue={job?.start_date} />
          <Field name="end_date" label="End date" type="date" defaultValue={job?.end_date} />
        </div>
      </fieldset>
      <fieldset className="nua-stack" style={{ border: 0, padding: 0 }}>
        <legend style={{ fontWeight: 700 }}>Pay (AUD)</legend>
        <p className="nua-hint">
          Listing pay builds candidate trust. It is shown as &ldquo;Disclosed&rdquo;. Leave blank to
          say pay is not disclosed.
        </p>
        <div className="nua-grid">
          <Field
            name="pay_min"
            label="From"
            type="number"
            step="0.01"
            min={0}
            defaultValue={job?.pay_min}
          />
          <Field
            name="pay_max"
            label="To"
            type="number"
            step="0.01"
            min={0}
            defaultValue={job?.pay_max}
          />
          <div className="nua-field">
            <label htmlFor="pay_period">Per</label>
            <select id="pay_period" name="pay_period" defaultValue={job?.pay_period ?? 'hour'}>
              <option value="hour">Hour</option>
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
            </select>
          </div>
          <div className="nua-field">
            <label htmlFor="super">Superannuation</label>
            <select id="super" name="super" defaultValue={superValue(job?.super_included)}>
              <option value="">Not stated</option>
              <option value="included">Included in pay</option>
              <option value="plus">On top of pay</option>
            </select>
          </div>
        </div>
      </fieldset>
      <Field
        name="skills"
        label="Skills"
        defaultValue={job?.skills.join(', ')}
        hint="Separate with commas, e.g. Barista, RSA"
      />
      <div>
        <Button type="submit">{submitLabel}</Button>
      </div>
    </form>
  );
}
