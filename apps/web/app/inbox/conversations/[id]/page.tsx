import type { Metadata } from 'next';
import { randomUUID } from 'node:crypto';
import { notFound } from 'next/navigation';
import { Button } from '@nua-crew/ui';
import { api, requireCandidate } from '@/lib/api';
import { closeConversation, reportConversation, sendCandidateMessage } from '../../../actions';
import { Flash, flashFrom } from '../../../components';

export const metadata: Metadata = { title: 'Conversation', robots: { index: false } };

export default async function Conversation({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCandidate();
  const { id } = await params;
  const { error, notice } = await flashFrom(searchParams);
  const client = await api();
  const path = { conversation_id: id };
  const [{ data: page }, { data: list }] = await Promise.all([
    client.GET('/v1/candidate/conversations/{conversation_id}/messages', { params: { path } }),
    client.GET('/v1/candidate/conversations'),
  ]);
  const conv = list?.find((c) => c.id === id);
  if (!page || !conv) notFound();
  await client.POST('/v1/candidate/conversations/{conversation_id}/read', { params: { path } });
  // The API returns newest first for paging; read top to bottom oldest first.
  const messages = [...page.items].sort((a, b) => a.created_at.localeCompare(b.created_at));
  return (
    <div className="nua-stack" style={{ maxWidth: 720 }}>
      <p>
        <a href="/inbox">← Invitations and messages</a>
      </p>
      <h1>{conv.counterpart}</h1>
      <p className="nua-hint">About: {conv.job_title}</p>
      <Flash error={error} notice={notice} />
      {page.next_before ? (
        <p className="nua-hint">Only your most recent messages are shown here.</p>
      ) : null}
      <ol className="nua-stack" aria-label="Messages" style={{ listStyle: 'none', padding: 0 }}>
        {messages.map((m) => (
          <li key={m.id} className="nua-card" style={{ marginLeft: m.mine ? 48 : 0 }}>
            <strong>{m.mine ? 'You' : conv.counterpart}</strong>{' '}
            <span className="nua-hint">{new Date(m.created_at).toLocaleString('en-AU')}</span>
            {/* Plain text only: React escapes it, and newlines are kept by CSS, never as HTML. */}
            <p style={{ whiteSpace: 'pre-wrap' }}>{m.body}</p>
            {!m.mine ? (
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
        {messages.length === 0 ? <li>No messages yet.</li> : null}
      </ol>
      {conv.status === 'open' ? (
        <>
          <form action={sendCandidateMessage} className="nua-card nua-stack">
            <input type="hidden" name="conversation_id" value={id} />
            <input type="hidden" name="client_key" value={randomUUID()} />
            <div className="nua-field">
              <label htmlFor="body">Message</label>
              <textarea id="body" name="body" required maxLength={2000} />
            </div>
            <p className="nua-hint">
              Do not share bank details, tax file numbers or ID documents here.
            </p>
            <div>
              <Button type="submit">Send</Button>
            </div>
          </form>
          <details>
            <summary>End this conversation</summary>
            <form action={closeConversation} className="nua-stack">
              <input type="hidden" name="conversation_id" value={id} />
              <p>
                Neither of you can send more messages. This does not block the employer; you can do
                that separately.
              </p>
              <Button type="submit" variant="danger">
                End conversation
              </Button>
            </form>
          </details>
        </>
      ) : (
        <p className="nua-hint">This conversation has been closed.</p>
      )}
    </div>
  );
}
