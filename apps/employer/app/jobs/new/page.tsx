import type { Metadata } from 'next';
import { ButtonLink } from '@nua-crew/ui';
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
      <div className="nua-card nua-row" style={{ justifyContent: 'space-between' }}>
        <div>
          <strong>Hiring in hospitality?</strong>
          <div className="nua-hint">
            Pick from 287 roles and check your pay against the award as you go.
          </div>
        </div>
        <ButtonLink href="/jobs/new/guided">Guided pay check</ButtonLink>
      </div>
      <JobForm action={createJob} locations={locations ?? []} submitLabel="Save draft" />
    </div>
  );
}
