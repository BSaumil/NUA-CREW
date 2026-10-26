import type { Metadata } from 'next';
import { Button } from '@nua-crew/ui';
import { api, requireEmployer } from '@/lib/api';
import { addMember } from '../actions';
import { Field, Flash, flashFrom } from '../components';

export const metadata: Metadata = { title: 'Team' };

export default async function Team({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { employerId, role } = await requireEmployer();
  const { error, notice } = await flashFrom(searchParams);
  const { data: members } = await (
    await api()
  ).GET('/v1/employers/{employer_id}/members', {
    params: { path: { employer_id: employerId } },
  });
  return (
    <div className="nua-stack">
      <h1>Team</h1>
      <Flash error={error} notice={notice} />
      <table className="nua-table">
        <thead>
          <tr>
            <th scope="col">Email</th>
            <th scope="col">Role</th>
          </tr>
        </thead>
        <tbody>
          {(members ?? []).map((m) => (
            <tr key={m.user_id}>
              <th scope="row">{m.email}</th>
              <td>{m.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {role === 'owner' ? (
        <form action={addMember} className="nua-card nua-stack" style={{ maxWidth: 480 }}>
          <h2>Add a team member</h2>
          <p className="nua-hint">
            They need a NUA CREW Hire account first. Email invitations are coming later.
          </p>
          <Field name="email" label="Their account email" type="email" required />
          <div className="nua-field">
            <label htmlFor="role">Role</label>
            <select id="role" name="role" defaultValue="recruiter">
              <option value="recruiter">Recruiter — can post jobs and manage applicants</option>
              <option value="viewer">Viewer — read only</option>
            </select>
          </div>
          <div>
            <Button type="submit">Add member</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
