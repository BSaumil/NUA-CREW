import type { Metadata } from 'next';
import { Button } from '@nua-crew/ui';
import { api, errorMessage, requireEmployer } from '@/lib/api';
import { Field, Flash } from '../components';

export const metadata: Metadata = { title: 'Find talent' };

type Params = Record<string, string | string[] | undefined>;
const one = (p: Params, k: string) => {
  const v = p[k];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? '';
};

const AVAIL_LABEL = {
  available: 'Free for this time',
  unavailable: 'Not free for this time',
  unknown: 'Availability unknown',
  not_requested: 'No time asked about',
} as const;
const HOURS_LABEL = {
  compatible: 'Meets the weekly hours you asked for',
  incompatible: 'Not a fit for those weekly hours',
  unknown: 'Weekly hours unknown',
  not_requested: '',
} as const;
const PAY_LABEL = {
  compatible: 'Pay expectations fit this job',
  not_confirmed: 'Pay fit not confirmed',
  not_requested: '',
} as const;

export default async function Talent({ searchParams }: { searchParams: Promise<Params> }) {
  const { employerId } = await requireEmployer();
  const p = await searchParams;
  const searched = one(p, 'kind') !== '';
  const client = await api();

  const { data: jobs } = await client.GET('/v1/employers/{employer_id}/jobs', {
    params: { path: { employer_id: employerId } },
  });

  let result: Awaited<ReturnType<typeof run>> | null = null;
  async function run() {
    const date = one(p, 'date');
    const start = one(p, 'start');
    const end = one(p, 'end');
    const skills = one(p, 'skills')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return client.POST('/v1/employers/{employer_id}/talent/search', {
      params: { path: { employer_id: employerId } },
      body: {
        kind: one(p, 'kind') === 'permanent' ? ('permanent' as const) : ('temporary' as const),
        job_id: one(p, 'job_id') || null,
        suburb: one(p, 'suburb') || null,
        state: (one(p, 'state') || null) as never,
        skills,
        window_date: date || null,
        window_start: start || null,
        window_end: end || null,
        window_time_zone: 'Australia/Melbourne',
        limit: 25,
        min_weekly_hours: one(p, 'min_weekly_hours') || null,
        availability: one(p, 'availability') === 'any' ? 'any' : 'available_or_unknown',
        after: one(p, 'after') || null,
      },
    });
  }
  if (searched) result = await run();
  const out = result?.data;
  const error = result && !out ? errorMessage(result.error) : undefined;

  return (
    <div className="nua-stack">
      <h1>Find talent</h1>
      <p className="nua-hint">
        You only see people who chose to be found for this kind of work. Results are not ranked and
        are not a prediction of who will accept or be a good hire. Every hiring decision is yours.
      </p>
      <Flash error={error} />
      <form method="get" className="nua-card nua-stack">
        <div className="nua-grid">
          <div className="nua-field">
            <label htmlFor="kind">Kind of work</label>
            <select id="kind" name="kind" defaultValue={one(p, 'kind') || 'temporary'}>
              <option value="temporary">Temporary</option>
              <option value="permanent">Permanent</option>
            </select>
          </div>
          <div className="nua-field">
            <label htmlFor="job_id">For which job (optional)</label>
            <select id="job_id" name="job_id" defaultValue={one(p, 'job_id')}>
              <option value="">No specific job</option>
              {(jobs ?? []).map((j) => (
                <option key={j.id} value={j.id}>
                  {j.title}
                </option>
              ))}
            </select>
            <p className="nua-hint">
              Choosing a job lets us say whether pay expectations fit its disclosed pay.
            </p>
          </div>
          <Field name="suburb" label="Suburb" defaultValue={one(p, 'suburb')} />
          <Field name="state" label="State" defaultValue={one(p, 'state')} hint="e.g. VIC" />
          <Field
            name="skills"
            label="Skills (any of)"
            defaultValue={one(p, 'skills')}
            hint="Separate with commas"
          />
        </div>
        <fieldset className="nua-stack" style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 700 }}>When (optional)</legend>
          <p className="nua-hint">
            Times are Melbourne time. An end time before the start runs into the next day. People
            who haven&rsquo;t shared availability show as &ldquo;unknown&rdquo;, never as free.
          </p>
          <div className="nua-grid">
            <Field name="date" label="Date" type="date" defaultValue={one(p, 'date')} />
            <Field name="start" label="From" type="time" defaultValue={one(p, 'start')} />
            <Field name="end" label="Until" type="time" defaultValue={one(p, 'end')} />
            <Field
              name="min_weekly_hours"
              label="Hours a week needed"
              type="number"
              min={0}
              max={168}
              step="0.5"
              defaultValue={one(p, 'min_weekly_hours')}
            />
          </div>
          <div className="nua-field">
            <label htmlFor="availability">Show</label>
            <select id="availability" name="availability" defaultValue={one(p, 'availability')}>
              <option value="available_or_unknown">Free or unknown</option>
              <option value="any">Everyone who can be found</option>
            </select>
          </div>
        </fieldset>
        <div>
          <Button type="submit">Search</Button>
        </div>
      </form>

      {out ? (
        <section className="nua-stack" aria-label="Search results">
          <h2>{out.items.length === 0 ? 'No one found' : `${out.items.length} found`}</h2>
          {out.items.length === 0 ? (
            <p>
              No one who has chosen to be found matches. People appear only when they&rsquo;ve
              turned discovery on for this kind of work.
            </p>
          ) : null}
          {out.items.map((c) => (
            <article key={c.ref} className="nua-card nua-stack">
              <h3>
                {c.display_name}
                {c.prefers_your_business ? (
                  <span className="nua-badge" style={{ marginLeft: 8 }}>
                    Prefers your business
                  </span>
                ) : null}
              </h3>
              <p>{[c.headline, c.area].filter(Boolean).join(' · ') || 'No headline shared'}</p>
              {c.skills.length ? <p>Skills: {c.skills.join(', ')}</p> : null}
              <ul>
                <li>{AVAIL_LABEL[c.availability.state]}</li>
                {HOURS_LABEL[c.hours_compat] ? <li>{HOURS_LABEL[c.hours_compat]}</li> : null}
                {PAY_LABEL[c.pay_compat] ? <li>{PAY_LABEL[c.pay_compat]}</li> : null}
                {c.notice_period_days != null ? (
                  <li>Notice period: {c.notice_period_days} days</li>
                ) : null}
                {c.available_from ? <li>Can start from {c.available_from}</li> : null}
              </ul>
              {c.unknowns.length ? (
                <p className="nua-hint">Not known: {c.unknowns.join('; ')}.</p>
              ) : null}
            </article>
          ))}
          <p className="nua-hint" role="note">
            {out.invite_unavailable_reason}
          </p>
          {out.next_after ? (
            <p>
              <a
                href={`/talent?${new URLSearchParams({
                  ...Object.fromEntries(
                    Object.entries(p).flatMap(([k, v]) => (typeof v === 'string' ? [[k, v]] : [])),
                  ),
                  after: out.next_after,
                }).toString()}`}
              >
                Show more
              </a>
            </p>
          ) : null}
          <ul className="nua-hint">
            {out.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
