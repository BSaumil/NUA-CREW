import type { Metadata } from 'next';
import { EmptyState, ButtonLink, StatusBadge } from '@nua-crew/ui';
import { api, requireCandidate } from '@/lib/api';

export const metadata: Metadata = { title: 'Your applications' };

export default async function Applications() {
  await requireCandidate();
  const { data } = await (await api()).GET('/v1/candidate/applications');
  const apps = data ?? [];
  return (
    <div className="nua-stack">
      <h1>Your applications</h1>
      {apps.length === 0 ? (
        <EmptyState
          title="No applications yet"
          description="When you apply for a job here, you can follow every step."
          action={<ButtonLink href="/jobs">Browse jobs</ButtonLink>}
        />
      ) : (
        <table className="nua-table">
          <caption className="nua-hint" style={{ textAlign: 'left' }}>
            Status changes shown here are made by the employer.
          </caption>
          <thead>
            <tr>
              <th scope="col">Job</th>
              <th scope="col">Employer</th>
              <th scope="col">Status</th>
              <th scope="col">Applied</th>
            </tr>
          </thead>
          <tbody>
            {apps.map((a) => (
              <tr key={a.id}>
                <th scope="row">
                  <a href={`/applications/${a.id}`}>{a.job.title}</a>
                </th>
                <td>{a.job.employer_name ?? '—'}</td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
                <td>{new Date(a.created_at).toLocaleDateString('en-AU')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
