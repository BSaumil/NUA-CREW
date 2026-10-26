import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Button, ButtonLink, EmptyState, SalaryDisclosure, StatusBadge } from '@nua-crew/ui';
import { api, canWrite, requireEmployer } from '@/lib/api';
import { closeJob, publishJob, unpublishJob } from '../../actions';
import { Flash, flashFrom } from '../../components';

export const metadata: Metadata = { title: 'Manage job' };

export default async function ManageJob({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { employerId, role } = await requireEmployer();
  const { id } = await params;
  const { error, notice } = await flashFrom(searchParams);
  const client = await api();
  const path = { employer_id: employerId, job_id: id };
  const [{ data: job }, { data: applicants }] = await Promise.all([
    client.GET('/v1/employers/{employer_id}/jobs/{job_id}', { params: { path } }),
    client.GET('/v1/employers/{employer_id}/jobs/{job_id}/applications', { params: { path } }),
  ]);
  if (!job) notFound();
  return (
    <div className="nua-stack">
      <Flash error={error} notice={notice} />
      <h1>{job.title}</h1>
      <p>
        Status: <span className="nua-badge">{job.status}</span> · {job.suburb ?? 'No location'}
      </p>
      <SalaryDisclosure
        min={job.pay_min}
        max={job.pay_max}
        period={job.pay_period}
        basis={job.pay_basis as never}
        superIncluded={job.super_included}
      />
      {canWrite(role) ? (
        <div className="nua-row">
          {job.status !== 'closed' && job.status !== 'expired' ? (
            <ButtonLink href={`/jobs/${job.id}/edit`} variant="secondary">
              Edit
            </ButtonLink>
          ) : null}
          {job.status === 'draft' || job.status === 'unpublished' ? (
            <form action={publishJob}>
              <input type="hidden" name="job_id" value={job.id} />
              <Button type="submit">Publish</Button>
            </form>
          ) : null}
          {job.status === 'published' ? (
            <form action={unpublishJob}>
              <input type="hidden" name="job_id" value={job.id} />
              <Button type="submit" variant="secondary">
                Unpublish
              </Button>
            </form>
          ) : null}
          {job.status === 'published' ? (
            <form action={closeJob}>
              <input type="hidden" name="job_id" value={job.id} />
              <Button type="submit" variant="danger">
                Close job
              </Button>
            </form>
          ) : null}
        </div>
      ) : null}
      <section className="nua-card" aria-labelledby="desc">
        <h2 id="desc">Description</h2>
        <p style={{ whiteSpace: 'pre-wrap' }}>{job.description}</p>
      </section>
      <section aria-labelledby="pipeline" className="nua-stack">
        <h2 id="pipeline">Applicants</h2>
        {(applicants ?? []).length === 0 ? (
          <EmptyState
            title="No applicants yet"
            description="Applications appear here as soon as candidates apply."
          />
        ) : (
          <table className="nua-table">
            <thead>
              <tr>
                <th scope="col">Candidate</th>
                <th scope="col">Suburb</th>
                <th scope="col">Skills</th>
                <th scope="col">Status</th>
                <th scope="col">Applied</th>
              </tr>
            </thead>
            <tbody>
              {applicants!.map((a) => (
                <tr key={a.application_id}>
                  <th scope="row">
                    <a href={`/applications/${a.application_id}`}>{a.full_name}</a>
                    {a.headline ? <div className="nua-hint">{a.headline}</div> : null}
                  </th>
                  <td>{a.suburb ?? '—'}</td>
                  <td>{a.skills.join(', ') || '—'}</td>
                  <td>
                    <StatusBadge status={a.status} />
                  </td>
                  <td>{new Date(a.created_at).toLocaleDateString('en-AU')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="nua-hint">
          Applicants appear in the order they applied. No AI ranking is applied to this list.
        </p>
      </section>
    </div>
  );
}
