import type { Metadata } from 'next';
import { Button } from '@nua-crew/ui';
import { api, canWrite, requireEmployer } from '@/lib/api';
import { withdrawInvitation } from '../actions';
import { Flash, flashFrom } from '../components';

export const metadata: Metadata = { title: 'Invitations' };

const STATUS: Record<string, string> = {
  pending: 'Waiting for a reply',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
};

export default async function Invitations({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { employerId, role } = await requireEmployer();
  const { error, notice } = await flashFrom(searchParams);
  const { data: items } = await (
    await api()
  ).GET('/v1/employers/{employer_id}/invitations', {
    params: { path: { employer_id: employerId } },
  });
  return (
    <div className="nua-stack">
      <h1>Invitations</h1>
      <Flash error={error} notice={notice} />
      <p className="nua-hint">
        An invitation is an expression of interest, not a job offer, an application or a shift
        booking. Status shows only what the candidate has done; we don&rsquo;t show whether they
        have looked at it. Someone who declines can&rsquo;t be invited again by your organisation
        for 30 days.
      </p>
      {(items ?? []).length === 0 ? (
        <p>No invitations yet. Find people under Find talent.</p>
      ) : (
        <table className="nua-table">
          <thead>
            <tr>
              <th scope="col">Candidate</th>
              <th scope="col">Job</th>
              <th scope="col">Type</th>
              <th scope="col">Status</th>
              <th scope="col">Expires</th>
              <th scope="col">Action</th>
            </tr>
          </thead>
          <tbody>
            {(items ?? []).map((i) => (
              <tr key={i.id}>
                <th scope="row">{i.candidate_label}</th>
                <td>{i.job_title}</td>
                <td>{i.kind === 'permanent' ? 'Permanent' : 'Temporary'}</td>
                <td>{STATUS[i.status] ?? i.status}</td>
                <td>{new Date(i.expires_at).toLocaleDateString('en-AU')}</td>
                <td>
                  {i.status === 'pending' && canWrite(role) ? (
                    <form action={withdrawInvitation}>
                      <input type="hidden" name="invitation_id" value={i.id} />
                      <Button type="submit" variant="secondary">
                        Withdraw
                      </Button>
                    </form>
                  ) : null}
                  {i.status === 'accepted' && i.conversation_id ? (
                    <a href={`/messages/${i.conversation_id}`}>Open conversation</a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
