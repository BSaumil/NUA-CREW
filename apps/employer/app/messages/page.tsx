import type { Metadata } from 'next';
import { api, requireEmployer } from '@/lib/api';
import { Flash, flashFrom } from '../components';

export const metadata: Metadata = { title: 'Messages' };

export default async function Messages({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { employerId } = await requireEmployer();
  const { error, notice } = await flashFrom(searchParams);
  const { data: items } = await (
    await api()
  ).GET('/v1/employers/{employer_id}/conversations', {
    params: { path: { employer_id: employerId } },
  });
  return (
    <div className="nua-stack">
      <h1>Messages</h1>
      <Flash error={error} notice={notice} />
      <p className="nua-hint">
        Conversations open only after a candidate accepts an invitation. Accepting shares no contact
        details, resume or calendar.
      </p>
      {(items ?? []).length === 0 ? (
        <p>No conversations yet.</p>
      ) : (
        <ul className="nua-stack">
          {(items ?? []).map((c) => (
            <li key={c.id} className="nua-card">
              <a href={`/messages/${c.id}`}>
                <strong>{c.counterpart}</strong> · {c.job_title}
              </a>
              {c.unread ? <span className="nua-badge"> New</span> : null}
              {c.status === 'closed' ? <span className="nua-hint"> · Closed</span> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
