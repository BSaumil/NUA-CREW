import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, ButtonLink, PayVerdict, type PayVerdictData } from '@nua-crew/ui';
import { api, canWrite, requireEmployer } from '@/lib/api';
import { Field, Flash, flashFrom } from '../../../components';
import { createGuidedJob, runPayCheck } from './actions';

export const metadata: Metadata = { title: 'Post a hospitality job' };

const STEPS = ['Venue', 'Role', 'Pay check', 'Review'] as const;
const VENUE_ICON: Record<string, string> = {
  cafe: '☕',
  takeaway: '🥡',
  restaurant: '🍽',
  fine_dining: '🥂',
  bar_pub: '🍺',
  club: '🎯',
  hotel_resort: '🏨',
  banquet_venue: '💍',
  catering: '🚚',
};
const AWARD_NAME: Record<string, string> = {
  MA000119: 'Restaurant',
  MA000009: 'Hospitality (general)',
  MA000003: 'Fast food',
  MA000058: 'Registered clubs',
};
const money = (minor: number | null | undefined) =>
  minor == null
    ? '—'
    : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(minor / 100);

function Progress({ step }: { step: number }) {
  return (
    <ol className="nua-progress" aria-label="Progress">
      {STEPS.map((label, i) => (
        <li key={label} aria-current={step === i + 1 ? 'step' : undefined} data-done={step > i + 1}>
          <span className="nua-progress__n" aria-hidden="true">
            {step > i + 1 ? '✓' : i + 1}
          </span>
          {label}
        </li>
      ))}
    </ol>
  );
}

const href = (p: Record<string, string | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(p)) if (v) q.set(k, v);
  return `/jobs/new/guided?${q.toString()}`;
};

export default async function GuidedJob({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { employerId, role: memberRole } = await requireEmployer();
  const { error, notice, p } = await flashFrom(searchParams);
  if (!canWrite(memberRole)) return <p role="alert">Your role cannot create jobs.</p>;
  const one = (k: string) => {
    const v = p[k];
    return (Array.isArray(v) ? v[0] : v) || undefined;
  };
  const rawStep = Number(one('step') ?? '1');
  const step = Number.isInteger(rawStep) ? Math.min(4, Math.max(1, rawStep)) : 1;
  const venue = one('venue');
  const roleCode = one('role');
  const inst = one('inst');
  const client = await api();

  return (
    <div className="nua-stack" style={{ maxWidth: 820 }}>
      <h1>Post a hospitality job</h1>
      <Progress step={step} />
      <Flash error={error} notice={notice} />
      {step === 1 ? <VenueStep client={client} /> : null}
      {step === 2 ? (
        <RoleStep client={client} venue={venue} q={one('q')} dept={one('dept')} loc={one('loc')} />
      ) : null}
      {step === 3 && roleCode ? (
        <PayStep
          client={client}
          employerId={employerId}
          venue={venue}
          roleCode={roleCode}
          inst={inst}
          loc={one('loc')}
          selection={{
            classification: one('classification'),
            coverage: one('coverage'),
            confirmed: one('confirmed'),
            employment: one('employment'),
            worker: one('worker'),
            rate: one('rate'),
            maximum: one('pay_max'),
            structure: one('structure'),
          }}
        />
      ) : null}
      {step === 4 && one('a') ? (
        <ReviewStep
          client={client}
          employerId={employerId}
          assessmentId={one('a')!}
          venue={venue}
          loc={one('loc')}
          inst={inst}
          roleCode={roleCode}
          payMax={one('pay_max')}
        />
      ) : null}
      {(step === 3 && !roleCode) || (step === 4 && !one('a')) ? (
        <p>
          Start again from the <Link href="/jobs/new/guided">first step</Link>.
        </p>
      ) : null}
      <p className="nua-hint">
        A job title never decides pay. You confirm the award and classification, and we check your
        rate against the reference minimums. Other roles?{' '}
        <Link href="/jobs/new">Use the quick draft form</Link>.
      </p>
    </div>
  );
}

type Client = Awaited<ReturnType<typeof api>>;

function Option({
  id,
  type,
  name,
  value,
  title,
  hint,
  badge,
  checked,
}: {
  id: string;
  type: 'checkbox' | 'radio';
  name: string;
  value?: string;
  title: React.ReactNode;
  hint?: string;
  badge?: string;
  checked?: boolean;
}) {
  return (
    <div className="nua-option">
      <input id={id} type={type} name={name} value={value} defaultChecked={checked} />
      <label htmlFor={id} className="nua-option__body">
        <strong>{title}</strong>
        {hint ? <span className="nua-hint">{hint}</span> : null}
        {badge ? <span className="nua-badge nua-badge--live">{badge}</span> : null}
      </label>
    </div>
  );
}

async function VenueStep({ client }: { client: Client }) {
  const { data: venues } = await client.GET('/v1/taxonomy/venue-types');
  return (
    <section className="nua-stack" aria-labelledby="s1">
      <h2 id="s1">What kind of venue is hiring?</h2>
      <ul className="nua-tiles">
        {(venues ?? []).map((v) => (
          <li key={v.code}>
            <Link className="nua-tile" href={href({ step: '2', venue: v.code })}>
              <span className="nua-tile__icon" aria-hidden="true">
                {VENUE_ICON[v.code] ?? '•'}
              </span>
              {v.name}
            </Link>
          </li>
        ))}
        <li>
          <Link className="nua-tile" href={href({ step: '2' })}>
            <span className="nua-tile__icon" aria-hidden="true">
              ＋
            </span>
            Not sure
            <small>Show every role</small>
          </Link>
        </li>
      </ul>
    </section>
  );
}

async function RoleStep({
  client,
  venue,
  q,
  dept,
  loc,
}: {
  client: Client;
  venue?: string;
  q?: string;
  dept?: string;
  loc?: string;
}) {
  const [{ data: departments }, { data: roles }] = await Promise.all([
    client.GET('/v1/taxonomy/departments'),
    client.GET('/v1/taxonomy/roles', {
      params: { query: { q, department: dept, venue_type: venue, limit: 24 } },
    }),
  ]);
  return (
    <section className="nua-stack" aria-labelledby="s2">
      <h2 id="s2">Which role?</h2>
      <form method="get" action="/jobs/new/guided" className="nua-row" role="search">
        <input type="hidden" name="step" value="2" />
        {venue ? <input type="hidden" name="venue" value={venue} /> : null}
        {dept ? <input type="hidden" name="dept" value={dept} /> : null}
        {loc ? <input type="hidden" name="loc" value={loc} /> : null}
        <div className="nua-field" style={{ flex: 1, minWidth: 220 }}>
          <label htmlFor="q">Search roles</label>
          <input id="q" name="q" defaultValue={q ?? ''} placeholder="e.g. waiter, CDP, barista" />
        </div>
        <Button type="submit">Search</Button>
      </form>
      <details open={Boolean(dept)}>
        <summary>
          Filter by department
          {dept ? ` (${(departments ?? []).find((d) => d.code === dept)?.name})` : ''}
        </summary>
        <ul className="nua-chips" aria-label="Departments">
          <li>
            <Link className="nua-chip" aria-current={!dept} href={href({ step: '2', venue, q })}>
              All
            </Link>
          </li>
          {(departments ?? []).map((d) => (
            <li key={d.code}>
              <Link
                className="nua-chip"
                aria-current={dept === d.code}
                href={href({ step: '2', venue, q, dept: d.code })}
              >
                {d.name}
              </Link>
            </li>
          ))}
        </ul>
      </details>
      {(roles ?? []).length === 0 ? (
        <p>No roles match. Try a shorter search or another department.</p>
      ) : (
        <ul className="nua-rolelist">
          {(roles ?? []).map((r) => (
            <li key={r.code}>
              <Link
                className="nua-role"
                href={href({ step: '3', venue, role: r.code, loc })}
                aria-label={`${r.title}, ${r.department_name}`}
              >
                <span>
                  <span className="nua-role__title">{r.title}</span>
                  <span className="nua-hint" style={{ display: 'block' }}>
                    {r.department_name}
                    {r.matched_alias ? ` · also called “${r.matched_alias}”` : ''}
                  </span>
                </span>
                {r.needs_review ? (
                  <span className="nua-badge nua-badge--warn">Award needs checking</span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function PayStep({
  client,
  employerId,
  venue,
  roleCode,
  inst,
  loc,
  selection,
}: {
  client: Client;
  employerId: string;
  selection: Record<string, string | undefined>;
  venue?: string;
  roleCode: string;
  inst?: string;
  loc?: string;
}) {
  const [{ data: role }, { data: guidance }, { data: awards }, { data: locations }] =
    await Promise.all([
      client.GET('/v1/taxonomy/roles/{code}', { params: { path: { code: roleCode } } }),
      client.GET('/v1/awards/coverage-guidance', {
        params: { query: { role_code: roleCode, venue_type: venue } },
      }),
      client.GET('/v1/awards'),
      client.GET('/v1/employers/{employer_id}/locations', {
        params: { path: { employer_id: employerId } },
      }),
    ]);
  const suggested = new Set((guidance?.suggestions ?? []).map((s) => s.instrument));
  const leads = new Set((guidance?.suggestions ?? []).flatMap((s) => s.classification_leads));
  const picked = awards?.find((a) => a.code === inst);
  const location = loc ?? locations?.[0]?.id;
  return (
    <section className="nua-stack" aria-labelledby="s3">
      <h2 id="s3">{role?.title ?? 'Pay check'}</h2>
      <p className="nua-hint">{guidance?.note}</p>
      <p className="nua-alert">
        Choose award → match duties → enter pay → review. Classification amounts below are base
        references; the server check applies casual loading and available penalties.
      </p>
      <p>
        <Link href={href({ step: '2', venue, role: roleCode, loc })}>Back to roles</Link>
      </p>
      <h3>1. Which award covers this work?</h3>
      <ul className="nua-tiles">
        {(awards ?? []).map((a) => (
          <li key={a.code}>
            <Link
              className="nua-tile"
              aria-current={inst === a.code}
              href={href({ step: '3', venue, role: roleCode, inst: a.code, loc })}
            >
              {AWARD_NAME[a.code] ?? a.title}
              <small>{a.code}</small>
              {suggested.has(a.code) ? (
                <span className="nua-badge nua-badge--live">Often used for this venue</span>
              ) : null}
            </Link>
          </li>
        ))}
        <li>
          <Link
            className="nua-tile"
            aria-current={inst === 'unknown'}
            href={href({ step: '3', venue, role: roleCode, inst: 'unknown', loc })}
          >
            Enterprise agreement / not sure
            <small>We&rsquo;ll flag it for review</small>
          </Link>
        </li>
      </ul>
      {inst ? (
        <form action={runPayCheck} className="nua-card nua-stack">
          <input type="hidden" name="venue" value={venue ?? ''} />
          <input type="hidden" name="role" value={roleCode} />
          <input type="hidden" name="inst" value={inst} />
          {picked ? (
            <>
              <Option
                id="coverage_confirmed"
                type="checkbox"
                name="coverage_confirmed"
                checked={selection.coverage === 'yes'}
                title="This award covers my business and this work"
                hint="Check with the Fair Work Ombudsman if unsure. Don’t tick this on a guess."
              />
              <fieldset className="nua-optionlist" style={{ border: 0, padding: 0 }}>
                <legend style={{ fontWeight: 700 }}>
                  2. Classification that matches the actual duties
                </legend>
                {picked.classifications.map((c) => (
                  <Option
                    key={c.code}
                    id={`class-${c.code}`}
                    type="radio"
                    name="classification"
                    value={c.code}
                    checked={selection.classification === c.code}
                    title={
                      <>
                        {c.label} <span className="nua-money">· {money(c.hourly_minor)}/h</span>
                      </>
                    }
                    hint={c.description}
                    badge={leads.has(c.code) ? 'Listed for this kind of role' : undefined}
                  />
                ))}
              </fieldset>
              <Option
                id="classification_confirmed"
                type="checkbox"
                name="classification_confirmed"
                checked={selection.confirmed === 'yes'}
                title="I’ve matched this to the real duties, skills and training"
                hint="The job title alone doesn’t set the level."
              />
            </>
          ) : (
            <p>
              We can&rsquo;t confirm a minimum without a known award. Continue to record your pay
              and flag it for review.
            </p>
          )}
          <div className="nua-grid">
            <div className="nua-field">
              <label htmlFor="employment">Employment</label>
              <select
                id="employment"
                name="employment"
                defaultValue={selection.employment ?? 'casual'}
              >
                <option value="casual">Casual</option>
                <option value="part_time">Part time</option>
                <option value="full_time">Full time</option>
              </select>
            </div>
            <div className="nua-field">
              <label htmlFor="worker_class">Worker</label>
              <select
                id="worker_class"
                name="worker_class"
                defaultValue={selection.worker ?? 'adult'}
              >
                <option value="adult">Adult</option>
                <option value="junior">Junior</option>
                <option value="apprentice">Apprentice</option>
                <option value="trainee">Trainee</option>
              </select>
            </div>
            <div className="nua-field">
              <label htmlFor="loc">Location</label>
              <select id="loc" name="loc" defaultValue={location} required>
                {(locations ?? []).map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name} — {l.suburb}
                  </option>
                ))}
              </select>
            </div>
            <Field
              name="pay_min"
              label="Hourly rate (AUD, before super)"
              defaultValue={selection.rate}
              type="number"
              step="0.01"
              min={0}
              required
            />
            <Field
              name="pay_max"
              label="Top of range (optional)"
              defaultValue={selection.maximum}
              type="number"
              step="0.01"
              min={0}
            />
            <div className="nua-field">
              <label htmlFor="rate_structure">How do you pay weekends?</label>
              <select
                id="rate_structure"
                name="rate_structure"
                defaultValue={selection.structure ?? 'base_plus_penalties'}
              >
                <option value="base_plus_penalties">Award penalty rates on top</option>
                <option value="flat_all_hours">One flat rate for all hours</option>
              </select>
            </div>
          </div>
          <div>
            <Button type="submit">Check this pay</Button>
          </div>
        </form>
      ) : null}
    </section>
  );
}

async function ReviewStep({
  client,
  employerId,
  assessmentId,
  venue,
  loc,
  inst,
  roleCode,
  payMax,
}: {
  client: Client;
  employerId: string;
  assessmentId: string;
  venue?: string;
  loc?: string;
  inst?: string;
  roleCode?: string;
  payMax?: string;
}) {
  const [{ data: a }, { data: role }] = await Promise.all([
    client.GET('/v1/employers/{employer_id}/pay-assessments/{assessment_id}', {
      params: { path: { employer_id: employerId, assessment_id: assessmentId } },
    }),
    roleCode
      ? client.GET('/v1/taxonomy/roles/{code}', { params: { path: { code: roleCode } } })
      : Promise.resolve({ data: undefined }),
  ]);
  if (!a) return <p role="alert">That pay check could not be found.</p>;
  const result = a.result as unknown as PayVerdictData & { needs_acknowledgement: boolean };
  const input = a.input as Record<string, string | boolean>;
  const back = href({
    step: '3',
    venue,
    role: roleCode,
    inst,
    loc,
    classification: String(input.classification ?? ''),
    coverage: input.coverage_confirmed ? 'yes' : undefined,
    confirmed: input.classification_confirmed ? 'yes' : undefined,
    employment: String(input.employment ?? 'casual'),
    worker: String(input.worker_class ?? 'adult'),
    rate: String(input.pay_amount ?? ''),
    pay_max: payMax,
    structure: String(input.rate_structure ?? 'base_plus_penalties'),
  });
  const blocked = result.status === 'below_minimum';
  return (
    <section className="nua-stack" aria-labelledby="s4">
      <h2 id="s4">Review and save</h2>
      <PayVerdict result={result} />
      {blocked ? (
        <div className="nua-row">
          <ButtonLink href={back}>Change the rate</ButtonLink>
        </div>
      ) : (
        <form action={createGuidedJob} className="nua-card nua-stack">
          <input type="hidden" name="a" value={assessmentId} />
          <input type="hidden" name="venue" value={venue ?? ''} />
          <input type="hidden" name="role" value={roleCode ?? ''} />
          <input type="hidden" name="inst" value={inst ?? ''} />
          <input type="hidden" name="loc" value={loc ?? ''} />
          <input type="hidden" name="pay_min" value={String(input.pay_amount ?? '')} />
          <input type="hidden" name="pay_max" value={payMax ?? ''} />
          <Field
            name="title"
            label="Job title shown to candidates"
            required
            defaultValue={role?.title}
          />
          <div className="nua-field">
            <label htmlFor="description">What will they do?</label>
            <textarea id="description" name="description" required maxLength={20000} />
          </div>
          <Field name="skills" label="Skills" hint="Separate with commas, e.g. Barista, RSA" />
          {result.needs_acknowledgement ? (
            <Option
              id="acknowledge"
              type="checkbox"
              name="acknowledge"
              title="I’ve reviewed the award coverage and classification myself"
              hint="We’ll record this. You can’t publish below an award minimum."
            />
          ) : null}
          <div className="nua-row">
            <Button type="submit">Save draft</Button>
            <ButtonLink href={back} variant="secondary">
              Change the pay
            </ButtonLink>
          </div>
          <p className="nua-hint">
            Publishing checks the pay again on the server using today&rsquo;s rates.
          </p>
        </form>
      )}
    </section>
  );
}
