import { ButtonLink, EmptyState, StatusBadge, WorkspaceSteps, WorkspaceTask } from '@nua-crew/ui';
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
  const [{ data: employer }, { data: jobs }, bookings, updates] = await Promise.all([
    client.GET('/v1/employers/{employer_id}', { params: { path: { employer_id: employerId } } }),
    client.GET('/v1/employers/{employer_id}/jobs', {
      params: { path: { employer_id: employerId } },
    }),
    client.GET('/v1/employers/{employer_id}/shift-bookings', {
      params: { path: { employer_id: employerId } },
    }),
    client.GET('/v1/notifications'),
  ]);
  const verified = employer?.verification_status === 'verified';
  return (
    <div className="nua-stack">
      <h1>{employer?.name ?? 'Your jobs'}</h1>
      <Flash error={error} notice={notice} />
      {!verified ? (
        <p role="note" className="nua-alert">
          <strong>Verification status: {employer?.verification_status ?? 'unavailable'}.</strong>{' '}
          You can draft jobs now, but they cannot be published until NUA CREW has reviewed your
          business and authorised representative. We never publish on an ABN number alone.
        </p>
      ) : null}
      <div className="nua-grid">
        <WorkspaceSteps title="Your hiring at a glance">
          <WorkspaceTask
            href="/#jobs"
            title="Live jobs"
            detail="Roles currently accepting applications."
            count={jobs ? jobs.filter((j) => j.status === 'published').length : null}
          />
          <WorkspaceTask
            href="/#jobs"
            title="Drafts"
            detail="Review role, location and pay before publishing."
            count={jobs ? jobs.filter((j) => j.status === 'draft').length : null}
          />
          <WorkspaceTask
            href="/shifts"
            title="Timesheets to review"
            detail="Approve or query actual hours with a note."
            count={
              bookings.data
                ? bookings.data.filter((b) => b.timesheet?.status === 'submitted').length
                : null
            }
          />
        </WorkspaceSteps>
        <WorkspaceSteps title="Keep things moving">
          {canWrite(role) ? (
            <WorkspaceTask
              href="/jobs/new/guided"
              title="Post with the role-and-pay guide"
              detail="Venue → role → pay check → review."
            />
          ) : null}
          <WorkspaceTask
            href="/notifications"
            title="Unread updates"
            detail="Updates for your account across your businesses."
            count={updates.data ? updates.data.filter((n) => !n.read_at).length : null}
          />
          <WorkspaceTask
            href="/team"
            title="Your business and team"
            detail="Check locations, people and verification."
          />
        </WorkspaceSteps>
      </div>
      {!jobs || bookings.error || updates.error ? (
        <p role="alert">
          Some information is unavailable. <a href="/">Reload your workspace</a>.
        </p>
      ) : null}
      <div className="nua-row" style={{ justifyContent: 'space-between' }}>
        <h2 id="jobs" style={{ margin: 0 }}>
          Jobs
        </h2>
        {canWrite(role) ? <ButtonLink href="/jobs/new">Post a job</ButtonLink> : null}
      </div>
      {(jobs ?? []).length === 0 ? (
        <EmptyState
          title="No jobs yet"
          description="Create your first job to start receiving applications."
        />
      ) : (
        <div className="nua-table-scroll" role="region" aria-label="Your jobs">
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
                    {j.status === 'published' ? (
                      <span className="nua-badge nua-badge--live">Live</span>
                    ) : (
                      <StatusBadge status={j.status} />
                    )}
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
        </div>
      )}
    </div>
  );
}
