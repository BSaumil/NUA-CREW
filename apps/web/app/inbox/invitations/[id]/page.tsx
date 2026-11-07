import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Button, SalaryDisclosure, changedTerms, termsLines } from '@nua-crew/ui';
import { api, requireCandidate } from '@/lib/api';
import { acceptInvitation, declineInvitation } from '../../../actions';
import { Flash, flashFrom } from '../../../components';

export const metadata: Metadata = { title: 'Invitation', robots: { index: false } };

export default async function Invitation({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCandidate();
  const { id } = await params;
  const { error, notice } = await flashFrom(searchParams);
  const { data: i } = await (
    await api()
  ).GET('/v1/candidate/invitations/{invitation_id}', {
    params: { path: { invitation_id: id } },
  });
  if (!i) notFound();
  const shown = i.terms_changed && i.current_terms ? i.current_terms : i.terms;
  const diffs = i.terms_changed && i.current_terms ? changedTerms(i.terms, i.current_terms) : [];
  return (
    <div className="nua-stack" style={{ maxWidth: 720 }}>
      <p>
        <a href="/inbox">← Invitations and messages</a>
      </p>
      <h1>
        {shown.title} at {shown.business}
      </h1>
      <p>
        <span className="nua-badge">{i.kind === 'permanent' ? 'Permanent' : 'Temporary'}</span>{' '}
        <span className="nua-hint">
          Sent {new Date(i.created_at).toLocaleDateString('en-AU')}
          {i.status === 'pending'
            ? ` · open until ${new Date(i.expires_at).toLocaleDateString('en-AU')}`
            : ''}
        </span>
      </p>
      <Flash error={error} notice={notice} />
      {i.note ? (
        <section className="nua-card">
          <h2>Their note</h2>
          {/* Plain text: React escapes it; line breaks are kept by CSS, never as HTML. */}
          <p style={{ whiteSpace: 'pre-wrap' }}>{i.note}</p>
        </section>
      ) : null}
      {diffs.length ? (
        <div role="alert" className="nua-alert">
          <strong>The job details changed since this invitation was sent</strong>
          <ul>
            {diffs.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <p>What you see below is the latest. Accepting means you have reviewed it.</p>
        </div>
      ) : null}
      <section className="nua-card nua-stack" aria-labelledby="role-h">
        <h2 id="role-h">The role</h2>
        <ul>
          {termsLines(shown)
            .slice(0, 4)
            .map((l) => (
              <li key={l}>{l}</li>
            ))}
        </ul>
        <SalaryDisclosure
          min={shown.pay_min}
          max={shown.pay_max}
          period={shown.pay_period}
          basis={shown.pay_basis as never}
          superIncluded={shown.super_included}
        />
        {!i.job_open ? <p role="alert">This job is no longer open.</p> : null}
        <p>
          <a href={`/jobs/${shown.job_id}`}>View the job</a>
        </p>
      </section>

      {i.status === 'pending' ? (
        <section className="nua-stack" aria-label="Respond">
          <p className="nua-hint">{i.acceptance_note}</p>
          <div className="nua-row">
            <form action={acceptInvitation}>
              <input type="hidden" name="id" value={i.id} />
              <input type="hidden" name="terms_hash" value={i.current_terms_hash ?? ''} />
              <Button type="submit" disabled={!i.can_accept}>
                {diffs.length ? 'Accept the updated details' : 'Accept and open a conversation'}
              </Button>
            </form>
            <form action={declineInvitation}>
              <input type="hidden" name="id" value={i.id} />
              <Button type="submit" variant="secondary">
                Decline
              </Button>
            </form>
          </div>
          <p className="nua-hint">You do not need to give a reason.</p>
        </section>
      ) : null}
      {i.status === 'accepted' && i.conversation_id ? (
        <p>
          <a className="nua-button" href={`/inbox/conversations/${i.conversation_id}`}>
            Open conversation
          </a>
        </p>
      ) : null}
      {i.status !== 'pending' && i.status !== 'accepted' ? (
        <p>
          {i.status === 'expired'
            ? 'This invitation expired. The employer would need to send a new one.'
            : i.status === 'withdrawn'
              ? 'The employer withdrew this invitation.'
              : 'You declined this invitation.'}
        </p>
      ) : null}
    </div>
  );
}
