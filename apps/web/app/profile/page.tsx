import type { Metadata } from 'next';
import { AiDisclosure, Button, ButtonLink } from '@nua-crew/ui';
import { api, requireCandidate } from '@/lib/api';
import { addResume, saveProfile, setDiscovery } from '../actions';
import { Field, Flash, flashFrom } from '../components';

export const metadata: Metadata = { title: 'Your profile' };

const TYPES = [
  ['casual', 'Casual'],
  ['part_time', 'Part time'],
  ['full_time', 'Full time'],
  ['contract', 'Contract'],
  ['shift', 'Shift'],
] as const;
const STATES = ['', 'VIC', 'NSW', 'QLD', 'SA', 'WA', 'TAS', 'ACT', 'NT'];

export default async function Profile({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCandidate();
  const { error, notice } = await flashFrom(searchParams);
  const client = await api();
  const [{ data: p }, { data: resumes }] = await Promise.all([
    client.GET('/v1/candidate/profile'),
    client.GET('/v1/candidate/resumes'),
  ]);
  if (!p) return <p role="alert">We could not load your profile.</p>;
  return (
    <div className="nua-stack">
      <h1>Your profile</h1>
      <a href="/documents">Manage your private document wallet</a>
      <Flash error={error} notice={notice} />
      <form action={saveProfile} className="nua-card nua-stack" aria-labelledby="profile-h">
        <h2 id="profile-h">About you</h2>
        <div className="nua-grid">
          <Field name="full_name" label="Full name" defaultValue={p.full_name} required />
          <Field
            name="headline"
            label="Headline"
            defaultValue={p.headline}
            hint="e.g. Barista with 5 years experience"
          />
          <Field name="suburb" label="Suburb" defaultValue={p.suburb} />
          <div className="nua-field">
            <label htmlFor="state">State</label>
            <select id="state" name="state" defaultValue={p.state ?? ''}>
              {STATES.map((s) => (
                <option key={s} value={s}>
                  {s || 'Select'}
                </option>
              ))}
            </select>
          </div>
          <Field name="postcode" label="Postcode" defaultValue={p.postcode} />
          <Field
            name="min_hourly_pay"
            label="Minimum hourly pay (AUD)"
            type="number"
            step="0.5"
            min={0}
            defaultValue={p.min_hourly_pay}
            hint="Private. Used only to estimate your pay match."
          />
        </div>
        <Field
          name="skills"
          label="Skills"
          defaultValue={p.skills.join(', ')}
          hint="Separate with commas."
        />
        <div className="nua-field">
          <label htmlFor="summary">Summary</label>
          <textarea id="summary" name="summary" defaultValue={p.summary ?? ''} maxLength={5000} />
        </div>
        <fieldset className="nua-field" style={{ border: 0, padding: 0 }}>
          <legend style={{ fontWeight: 600 }}>Work you are open to</legend>
          <div className="nua-row">
            {TYPES.map(([v, l]) => (
              <label key={v} className="nua-row">
                <input
                  type="checkbox"
                  name="types"
                  value={v}
                  defaultChecked={p.preferred_employment_types.includes(v)}
                />
                {l}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <Button type="submit">Save profile</Button>
        </div>
      </form>

      <section
        className="nua-card nua-row"
        aria-labelledby="roles-h"
        style={{ justifyContent: 'space-between' }}
      >
        <div>
          <h2 id="roles-h" style={{ marginBottom: 4 }}>
            Roles you do
          </h2>
          <p className="nua-hint" style={{ margin: 0 }}>
            Waiter, barista, chef de partie… Pick several to improve your matches.
          </p>
        </div>
        <ButtonLink href="/profile/roles" variant="secondary">
          Choose roles
        </ButtonLink>
      </section>
      <section className="nua-card nua-stack" aria-labelledby="resume-h">
        <h2 id="resume-h">Resumes</h2>
        {(resumes ?? []).length === 0 ? (
          <p className="nua-muted">No resumes yet. Paste your resume text below.</p>
        ) : (
          <ul>
            {resumes!.map((r) => (
              <li key={r.id}>
                {r.title} — version {r.versions.at(-1)?.version}
              </li>
            ))}
          </ul>
        )}
        <form action={addResume} className="nua-stack">
          <Field name="title" label="Resume name" required />
          <div className="nua-field">
            <label htmlFor="content_text">Resume text</label>
            <textarea id="content_text" name="content_text" required maxLength={50000} />
            <span className="nua-hint">
              Only employers you apply to can see your resume. File uploads are coming later.
            </span>
          </div>
          <div>
            <Button type="submit" variant="secondary">
              Save resume
            </Button>
          </div>
        </form>
      </section>

      <section className="nua-card nua-stack" aria-labelledby="privacy-h">
        <h2 id="privacy-h">Privacy</h2>
        <form action={setDiscovery} className="nua-stack">
          <div className="nua-row">
            <input id="granted" name="granted" type="checkbox" defaultChecked={p.discoverable} />
            <label htmlFor="granted">
              Let verified employers discover my profile (off by default)
            </label>
          </div>
          <div>
            <Button type="submit" variant="secondary">
              Save privacy choice
            </Button>
          </div>
        </form>
        <AiDisclosure />
      </section>
    </div>
  );
}
