import type { Metadata } from 'next';
import { Button, EmptyState } from '@nua-crew/ui';
import { api, requireCandidate } from '@/lib/api';
import { setInvitationsEnabled } from '../actions';
import { Flash, flashFrom } from '../components';

export const metadata: Metadata = { title: 'Invitations and messages', robots: { index: false } };

const STATUS: Record<string, string> = {
  pending: 'Waiting for you',
  accepted: 'Accepted',
  declined: 'Declined',
  withdrawn: 'Withdrawn by employer',
  expired: 'Expired',
};

export default async function Inbox({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCandidate();
  const { error, notice } = await flashFrom(searchParams);
  const client = await api();
  const [inv, convs, settings] = await Promise.all([
    client.GET('/v1/candidate/invitations'),
    client.GET('/v1/candidate/conversations'),
    client.GET('/v1/candidate/invitation-settings'),
  ]);
  const failed = !inv.data || !convs.data;
  return (
    <div className="nua-stack">
      <h1>Invitations and messages</h1>
      <p>
        An invitation is an employer saying they are interested. It is not an application, a job
        offer or a held shift. You can decline without giving a reason, and no one can message you
        until you accept.
      </p>
      <Flash error={error} notice={notice} />
      {failed ? (
        <p role="alert">
          We couldn’t load your inbox. <a href="/inbox">Try again</a>.
        </p>
      ) : (
        <>
          <section className="nua-stack" aria-labelledby="inv-h">
            <h2 id="inv-h">Invitations</h2>
            {inv.data!.items.length === 0 ? (
              <EmptyState
                title="No invitations"
                description="Employers can only invite you if you have chosen to be discoverable."
              />
            ) : (
              <ul className="nua-stack" aria-label="Invitations">
                {inv.data!.items.map((i) => (
                  <li key={i.id} className="nua-card">
                    <a href={`/inbox/invitations/${i.id}`}>
                      {i.terms.title} at {i.terms.business}
                    </a>{' '}
                    <span className="nua-badge">{STATUS[i.status] ?? i.status}</span>
                    {i.unread && i.status === 'pending' ? (
                      <span className="nua-badge nua-badge--live"> New</span>
                    ) : null}
                    <p className="nua-hint">
                      {i.kind === 'permanent' ? 'Permanent' : 'Temporary'} · received{' '}
                      {new Date(i.created_at).toLocaleDateString('en-AU')}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="nua-stack" aria-labelledby="conv-h">
            <h2 id="conv-h">Conversations</h2>
            {convs.data!.length === 0 ? (
              <EmptyState
                title="No conversations"
                description="A conversation opens when you accept an invitation."
              />
            ) : (
              <ul className="nua-stack" aria-label="Conversations">
                {convs.data!.map((c) => (
                  <li key={c.id} className="nua-card">
                    <a href={`/inbox/conversations/${c.id}`}>{c.counterpart}</a> about {c.job_title}{' '}
                    {c.unread ? <span className="nua-badge nua-badge--live">New</span> : null}
                    {c.status === 'closed' ? <span className="nua-badge">Closed</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="nua-card nua-stack" aria-labelledby="set-h">
            <h2 id="set-h">New invitations</h2>
            <p>
              {settings.data?.invitations_enabled === false
                ? 'New invitations are paused.'
                : 'Verified employers can invite you if you are discoverable.'}{' '}
              Pausing does not change invitations you already have or open conversations. Who can
              find you is set under <a href="/work-preferences">work preferences</a>.
            </p>
            <form action={setInvitationsEnabled}>
              <input
                type="hidden"
                name="enabled"
                value={settings.data?.invitations_enabled === false ? '1' : '0'}
              />
              <Button type="submit" variant="secondary">
                {settings.data?.invitations_enabled === false
                  ? 'Allow new invitations'
                  : 'Pause new invitations'}
              </Button>
            </form>
          </section>
        </>
      )}
    </div>
  );
}
