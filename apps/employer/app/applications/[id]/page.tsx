import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Button, StatusBadge } from '@nua-crew/ui';
import { api, canWrite, requireEmployer } from '@/lib/api';
import { addNote, changeStatus } from '../../actions';
import { Flash, flashFrom } from '../../components';

export const metadata: Metadata = { title: 'Applicant' };

const NEXT: Record<string, [string, string][]> = {
  submitted: [['under_review', 'Start review']],
  under_review: [['shortlisted', 'Shortlist']],
  shortlisted: [['interview', 'Move to interview']],
  interview: [['offer', 'Make offer']],
  offer: [['hired', 'Mark as hired']],
};
const CAN_REJECT = new Set(['submitted', 'under_review', 'shortlisted', 'interview', 'offer']);

export default async function Applicant({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { employerId, role } = await requireEmployer();
  const { id } = await params;
  const { error, notice } = await flashFrom(searchParams);
  const { data: a } = await (
    await api()
  ).GET('/v1/employers/{employer_id}/applications/{application_id}', {
    params: { path: { employer_id: employerId, application_id: id } },
  });
  if (!a) notFound();
  const documents = await (
    await api()
  ).GET('/v1/employers/{employer_id}/applications/{application_id}/documents', {
    params: { path: { employer_id: employerId, application_id: id } },
  });
  const write = canWrite(role);
  return (
    <div className="nua-stack">
      <Flash error={error} notice={notice} />
      <h1>{a.full_name}</h1>
      <p className="nua-muted">
        Applied for <a href={`/jobs/${a.job_id}`}>{a.job_title}</a> ·{' '}
        <StatusBadge status={a.status} />
      </p>
      <section className="nua-card nua-stack" aria-labelledby="profile">
        <h2 id="profile">Candidate</h2>
        {a.headline ? <p>{a.headline}</p> : null}
        <p>
          <strong>Skills:</strong> {a.skills.join(', ') || 'None listed'}
        </p>
        {a.summary ? <p style={{ whiteSpace: 'pre-wrap' }}>{a.summary}</p> : null}
        {a.cover_note ? (
          <>
            <h3>Note from candidate</h3>
            <p style={{ whiteSpace: 'pre-wrap' }}>{a.cover_note}</p>
          </>
        ) : null}
        {a.resume_text ? (
          <>
            <h3>Resume</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit' }}>{a.resume_text}</pre>
          </>
        ) : null}
      </section>

      <section className="nua-card nua-stack">
        <h2>Documents shared for this application</h2>
        <p className="nua-hint">
          Scanned files are not verified qualifications. Access ends if the candidate withdraws or
          removes a file.
        </p>
        {documents.error ? (
          <p role="alert">Documents are currently unavailable.</p>
        ) : documents.data?.length ? (
          documents.data.map((d) => (
            <p key={d.id}>
              <a href={`/applications/${id}/documents/${d.id}`}>{d.title}</a> ·{' '}
              {d.kind.replaceAll('_', ' ')} · Not verified
            </p>
          ))
        ) : (
          <p>No files were shared.</p>
        )}
      </section>
      {write ? (
        <section className="nua-card nua-stack" aria-labelledby="actions">
          <h2 id="actions">Decision</h2>
          <div className="nua-row">
            {(NEXT[a.status] ?? []).map(([to, label]) => (
              <form key={to} action={changeStatus}>
                <input type="hidden" name="application_id" value={a.application_id} />
                <input type="hidden" name="to_status" value={to} />
                <Button type="submit">{label}</Button>
              </form>
            ))}
          </div>
          {CAN_REJECT.has(a.status) ? (
            <form action={changeStatus} className="nua-stack">
              <input type="hidden" name="application_id" value={a.application_id} />
              <input type="hidden" name="to_status" value="rejected" />
              <div className="nua-field">
                <label htmlFor="reject-note">
                  Reason for not progressing (required, kept internal)
                </label>
                <textarea id="reject-note" name="note" required maxLength={2000} />
              </div>
              <div>
                <Button type="submit" variant="danger">
                  Do not progress
                </Button>
              </div>
            </form>
          ) : null}
          <p className="nua-hint">Every decision is made and recorded by a person on your team.</p>
        </section>
      ) : null}

      <section className="nua-card nua-stack" aria-labelledby="history">
        <h2 id="history">History and private notes</h2>
        <ol>
          {a.events.map((e) => (
            <li key={e.id}>
              <strong>{e.event_type.replace('_', ' ')}</strong>
              {e.to_status ? <> → {e.to_status}</> : null} · {e.actor_role} ·{' '}
              <time dateTime={e.created_at}>{new Date(e.created_at).toLocaleString('en-AU')}</time>
              {e.note ? <div className="nua-muted">{e.note}</div> : null}
            </li>
          ))}
        </ol>
        {write ? (
          <form action={addNote} className="nua-stack">
            <input type="hidden" name="application_id" value={a.application_id} />
            <div className="nua-field">
              <label htmlFor="note">Private note (never shown to the candidate)</label>
              <textarea id="note" name="note" required maxLength={2000} />
            </div>
            <div>
              <Button type="submit" variant="secondary">
                Add note
              </Button>
            </div>
          </form>
        ) : null}
      </section>
    </div>
  );
}
