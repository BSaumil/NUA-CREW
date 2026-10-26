import type { Metadata } from 'next';
import { api, canWrite, requireEmployer } from '@/lib/api';
import { createJob } from '../../actions';
import { Flash, flashFrom } from '../../components';
import { JobForm } from '../../job-form';

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
      <JobForm action={createJob} locations={locations ?? []} submitLabel="Save draft" />
    </div>
  );
}
