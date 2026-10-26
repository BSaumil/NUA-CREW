import { ButtonLink, EmptyState, StatusBadge } from '@nua-crew/ui';
import { api, canWrite, requireEmployer } from '@/lib/api';
import { Flash, flashFrom } from './components';

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { employerId, role } = await requireEmployer();
  const { error, notice } = await flashFrom(searchParams);
  const client = await api();
  const [{ data: employer }, { data: jobs }] = await Promise.all([
    client.GET('/v1/employers/{employer_id}', { params: { path: { employer_id: employerId } } }),
    client.GET('/v1/employers/{employer_id}/jobs', {
      params: { path: { employer_id: employerId } },
    }),
  ]);
  const verified = employer?.verification_status === 'verified';
  return (
    <div className="nua-stack">
      <h1>{employer?.name ?? 'Your jobs'}</h1>
      <Flash error={error} notice={notice} />
      {!verified ? (
        <p role="note" className="nua-alert">
          <strong>Verification status: {employer?.verification_status}.</strong> You can draft jobs
          now, but they cannot be published until NUA CREW has reviewed your business and authorised
          representative. We never publish on an ABN number alone.
        </p>
      ) : null}
      <div className="nua-row" style={{ justifyContent: 'space-between' }}>
        <h2 style={{ margin: 0 }}>Jobs</h2>
        {canWrite(role) ? <ButtonLink href="/jobs/new">Post a job</ButtonLink> : null}
      </div>
      {(jobs ?? []).length === 0 ? (
        <EmptyState
          title="No jobs yet"
          description="Create your first job to start receiving applications."
        />
      ) : (
        <table className="nua-table">
          <thead>
            <tr>
              <th scope="col">Title</th>
              <th scope="col">Status</th>
              <th scope="col">Location</th>
              <th scope="col">Pay</th>
            </tr>
          </thead>
          <tbody>
            {jobs!.map((j) => (
              <tr key={j.id}>
                <th scope="row">
                  <a href={`/jobs/${j.id}`}>{j.title}</a>
                </th>
                <td>
                  <StatusBadge status={j.status === 'published' ? 'under_review' : j.status} />{' '}
                  <span className="nua-muted">{j.status}</span>
                </td>
                <td>{j.suburb ?? '—'}</td>
                <td>
                  {j.pay_basis === 'not_disclosed'
                    ? 'Not disclosed'
                    : `${j.pay_min ?? ''}–${j.pay_max ?? ''}/${j.pay_period}`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
