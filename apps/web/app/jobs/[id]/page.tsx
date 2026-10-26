import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import {
  AiDisclosure,
  Button,
  ButtonLink,
  MatchBreakdown,
  SalaryDisclosure,
  TrustIndicator,
  employmentTypeLabel,
} from '@nua-crew/ui';
import { api, getViewer } from '@/lib/api';
import { apply } from '../../actions';
import { Flash, flashFrom } from '../../components';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { data } = await (
    await api()
  ).GET('/v1/jobs/{job_id}', { params: { path: { job_id: id } } });
  return { title: data?.title ?? 'Job' };
}

export default async function JobPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { error, notice } = await flashFrom(searchParams);
  const client = await api();
  const { data: job } = await client.GET('/v1/jobs/{job_id}', { params: { path: { job_id: id } } });
  if (!job) notFound();
  const viewer = await getViewer();
  const candidate = viewer?.role === 'candidate';
  const [match, resumes, mine] = candidate
    ? await Promise.all([
        client.GET('/v1/jobs/{job_id}/match', { params: { path: { job_id: id } } }),
        client.GET('/v1/candidate/resumes'),
        client.GET('/v1/candidate/applications'),
      ])
    : [null, null, null];
  const existing = mine?.data?.find((a) => a.job.id === id && a.status !== 'withdrawn');

  return (
    <article className="nua-stack">
      <Flash error={error} notice={notice} />
      <header className="nua-stack">
        <h1 style={{ marginBottom: 4 }}>{job.title}</h1>
        <p className="nua-muted" style={{ margin: 0 }}>
          {job.employer.name ?? 'Employer not named'}
          {job.suburb ? ` · ${job.suburb}, ${job.state}` : ''} ·{' '}
          {employmentTypeLabel(job.employment_type)}
        </p>
        <TrustIndicator
          status={(job.employer.verification_status ?? null) as never}
          source={job.attribution}
        />
        <SalaryDisclosure
          min={job.pay_min}
          max={job.pay_max}
          period={job.pay_period}
          basis={job.pay_basis as never}
          superIncluded={job.super_included}
        />
        {job.last_verified_at ? (
          <p className="nua-hint">
            Listing last checked{' '}
            <time dateTime={job.last_verified_at}>
              {new Date(job.last_verified_at).toLocaleDateString('en-AU')}
            </time>
          </p>
        ) : null}
      </header>

      <section aria-labelledby="about" className="nua-card">
        <h2 id="about">About the role</h2>
        <p style={{ whiteSpace: 'pre-wrap' }}>{job.description}</p>
        {job.skills.length ? (
          <p>
            <strong>Skills:</strong> {job.skills.join(', ')}
          </p>
        ) : null}
        {job.attribution ? <p className="nua-hint">Source: {job.attribution}</p> : null}
      </section>

      {job.origin === 'ingested' && job.apply_url ? (
        <section className="nua-card nua-stack" aria-labelledby="ext">
          <h2 id="ext">Apply on the employer&apos;s site</h2>
          <p className="nua-muted">
            This job is hosted elsewhere. Applications you make there are not tracked by NUA CREW,
            so we cannot confirm they were received or viewed.
          </p>
          <ButtonLink href={job.apply_url} target="_blank" rel="noopener noreferrer nofollow">
            Go to application site
          </ButtonLink>
        </section>
      ) : null}

      {match?.data ? (
        <>
          <MatchBreakdown
            estimate={match.data.estimate ?? null}
            components={match.data.components}
            missingSkills={match.data.missing_skills}
            label={match.data.label}
          />
          <AiDisclosure />
        </>
      ) : null}

      {job.origin === 'direct' ? (
        <section className="nua-card nua-stack" aria-labelledby="apply">
          <h2 id="apply">Apply</h2>
          {!candidate ? (
            <p>
              <a href={`/login?next=/jobs/${job.id}`}>Log in</a> or{' '}
              <a href="/register">create a free account</a> to apply. Applying is always free.
            </p>
          ) : existing ? (
            <p>
              You applied for this job.{' '}
              <a href={`/applications/${existing.id}`}>View your application</a>
            </p>
          ) : (
            <form action={apply} className="nua-stack">
              <input type="hidden" name="job_id" value={job.id} />
              <div className="nua-field">
                <label htmlFor="resume_id">Resume</label>
                <select id="resume_id" name="resume_id" defaultValue="">
                  <option value="">No resume attached</option>
                  {(resumes?.data ?? []).map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.title} (v{r.versions.at(-1)?.version})
                    </option>
                  ))}
                </select>
                <span className="nua-hint">
                  Your resume and profile are shared with this employer when you apply.{' '}
                  <a href="/profile">Add or edit resumes</a>
                </span>
              </div>
              <div className="nua-field">
                <label htmlFor="cover_note">Note to the employer (optional)</label>
                <textarea id="cover_note" name="cover_note" maxLength={5000} />
              </div>
              <div>
                <Button type="submit">Submit application</Button>
              </div>
            </form>
          )}
        </section>
      ) : null}
    </article>
  );
}
