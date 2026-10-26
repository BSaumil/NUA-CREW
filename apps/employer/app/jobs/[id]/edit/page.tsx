import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { api, canWrite, requireEmployer } from '@/lib/api';
import { updateJob } from '../../../actions';
import { Flash, flashFrom } from '../../../components';
import { JobForm } from '../../../job-form';

export const metadata: Metadata = { title: 'Edit job' };

export default async function EditJob({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { employerId, role } = await requireEmployer();
  const { id } = await params;
  const { error } = await flashFrom(searchParams);
  const client = await api();
  const [{ data: job }, { data: locations }] = await Promise.all([
    client.GET('/v1/employers/{employer_id}/jobs/{job_id}', {
      params: { path: { employer_id: employerId, job_id: id } },
    }),
    client.GET('/v1/employers/{employer_id}/locations', {
      params: { path: { employer_id: employerId } },
    }),
  ]);
  if (!job) notFound();
  if (!canWrite(role) || job.status === 'closed' || job.status === 'expired') {
    return <p role="alert">This job can no longer be edited.</p>;
  }
  return (
    <div className="nua-stack" style={{ maxWidth: 720 }}>
      <h1>Edit job</h1>
      {job.status === 'published' ? (
        <p role="note" className="nua-alert">
          This job is live. Changes are visible to candidates as soon as you save.
        </p>
      ) : null}
      <Flash error={error} />
      <JobForm
        action={updateJob}
        locations={locations ?? []}
        job={job}
        submitLabel="Save changes"
      />
    </div>
  );
}
