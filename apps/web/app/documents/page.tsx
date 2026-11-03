import { Button, ButtonLink } from '@nua-crew/ui';
import { api, requireCandidate } from '@/lib/api';
import { deleteDocument } from './actions';
import { UploadForm } from './upload-form';

export default async function Documents({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  await requireCandidate();
  const query = await searchParams;
  const client = await api();
  const [status, docs] = await Promise.all([
    client.GET('/v1/documents/status'),
    client.GET('/v1/candidate/documents'),
  ]);
  const ready = status.data?.upload_enabled === true;
  return (
    <div className="nua-stack">
      <h1>Your document wallet</h1>
      <p>
        Private until you choose files to share with a job application. Uploading does not verify a
        qualification.
      </p>
      <ButtonLink href="/profile" variant="secondary">
        Back to profile
      </ButtonLink>
      {query.error ? <p role="alert">{query.error}</p> : null}
      {query.notice ? <p role="status">{query.notice}</p> : null}
      <p role="status">
        {String(status.data?.message ?? 'Document storage is currently unavailable.')}
      </p>
      <section className="nua-card">
        <UploadForm enabled={ready} />
      </section>
      <section className="nua-stack">
        <h2>Saved documents</h2>
        {docs.error ? (
          <p role="alert">We could not load your documents. Reload to retry.</p>
        ) : !docs.data?.length ? (
          <p>No documents yet. Resume text entry remains available in Profile.</p>
        ) : (
          docs.data.map((d) => (
            <article className="nua-card nua-stack" key={d.id}>
              <h3>{d.title}</h3>
              <p>
                {d.kind.replaceAll('_', ' ')} ·{' '}
                {d.status === 'ready'
                  ? 'Scanned file · qualification not verified'
                  : 'Upload incomplete'}
              </p>
              {d.jurisdiction ? <p>State/territory: {d.jurisdiction}</p> : null}
              {d.review_due_on ? <p>Refresher/review due: {d.review_due_on}</p> : null}
              <div className="nua-row">
                {d.status === 'ready' ? <a href={`/documents/${d.id}/download`}>Download</a> : null}
                <form action={deleteDocument}>
                  <input name="id" type="hidden" value={d.id} />
                  <Button type="submit" variant="secondary">
                    Remove {d.title}
                  </Button>
                </form>
              </div>
            </article>
          ))
        )}
      </section>
      <p className="nua-hint">
        RSA recognition and refresher rules depend on the state. Record the certificate and latest
        refresher separately; no automatic national-validity claim is made.
      </p>
    </div>
  );
}
