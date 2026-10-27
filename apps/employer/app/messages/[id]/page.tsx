import type { Metadata } from 'next';
import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { Button } from '@nua-crew/ui';
import { api, canWrite, requireEmployer } from '@/lib/api';
import { reportConversation, sendMessage } from '../../actions';
import { Flash, flashFrom } from '../../components';

export const metadata: Metadata = { title: 'Conversation' };

export default async function Thread({
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
  const path = { employer_id: employerId, conversation_id: id };
  const [{ data: page }, { data: list }] = await Promise.all([
    client.GET('/v1/employers/{employer_id}/conversations/{conversation_id}/messages', {
      params: { path },
    }),
    client.GET('/v1/employers/{employer_id}/conversations', {
      params: { path: { employer_id: employerId } },
    }),
  ]);
  const conv = list?.find((c) => c.id === id);
  if (!page || !conv) notFound();
  await client.POST('/v1/employers/{employer_id}/conversations/{conversation_id}/read', {
    params: { path },
  });
  return (
    <div className="nua-stack">
      <h1>{conv.counterpart}</h1>
      <p className="nua-hint">About: {conv.job_title}</p>
      <Flash error={error} notice={notice} />
      <ol className="nua-stack" aria-label="Messages" style={{ listStyle: 'none', padding: 0 }}>
        {page.items.map((m) => (
          <li key={m.id} className="nua-card" style={{ marginLeft: m.mine ? 48 : 0 }}>
            <strong>{m.mine ? 'You' : conv.counterpart}</strong>{' '}
            <span className="nua-hint">{new Date(m.created_at).toLocaleString('en-AU')}</span>
            {/* Plain text only: React escapes it, and newlines are kept by CSS, never as HTML. */}
            <p style={{ whiteSpace: 'pre-wrap' }}>{m.body}</p>
            {!m.mine && canWrite(role) ? (
              <details>
                <summary>Report this message</summary>
                <form action={reportConversation} className="nua-stack">
                  <input type="hidden" name="conversation_id" value={id} />
                  <input type="hidden" name="message_id" value={m.id} />
                  <label htmlFor={`r-${m.id}`}>What is wrong?</label>
                  <textarea id={`r-${m.id}`} name="reason" required minLength={3} maxLength={500} />
                  <Button type="submit" variant="secondary">
                    Send report
                  </Button>
                </form>
              </details>
            ) : null}
          </li>
        ))}
        {page.items.length === 0 ? <li>No messages yet. Say hello.</li> : null}
      </ol>
      {conv.status === 'open' && canWrite(role) ? (
        <form action={sendMessage} className="nua-card nua-stack">
          <input type="hidden" name="conversation_id" value={id} />
          <input type="hidden" name="client_key" value={randomUUID()} />
          <div className="nua-field">
            <label htmlFor="body">Message</label>
            <textarea id="body" name="body" required maxLength={2000} />
          </div>
          <p className="nua-hint">
            Don&rsquo;t ask for bank details, tax file numbers or ID documents here.
          </p>
          <div>
            <Button type="submit">Send</Button>
          </div>
        </form>
      ) : (
        <p className="nua-hint">
          {conv.status === 'closed'
            ? 'This conversation has been closed.'
            : 'Viewers can read but not reply.'}
        </p>
      )}
    </div>
  );
}
