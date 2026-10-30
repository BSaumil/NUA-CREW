import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Button, StatusBadge } from '@nua-crew/ui';
import { api, requireCandidate } from '@/lib/api';
import { withdraw } from '../../actions';
import { Flash, flashFrom } from '../../components';

export const metadata: Metadata = { title: 'Application' };

const EVENT_COPY: Record<string, string> = {
  submitted: 'You submitted this application',
  status_changed: 'The employer updated your status',
  withdrawn: 'You withdrew this application',
};

export default async function ApplicationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCandidate();
  const { id } = await params;
  const { error, notice } = await flashFrom(searchParams);
  const { data: app } = await (
    await api()
  ).GET('/v1/candidate/applications/{application_id}', {
    params: { path: { application_id: id } },
  });
  if (!app) notFound();
  const terminal = ['hired', 'rejected', 'withdrawn'].includes(app.status);
  return (
    <div className="nua-stack">
      <Flash error={error} notice={notice} />
      <h1>{app.job.title}</h1>
      <p className="nua-muted">
        {app.job.employer_name ?? 'Employer'} {app.job.suburb ? `· ${app.job.suburb}` : ''}
      </p>
      <p>
        Status: <StatusBadge status={app.status} />
      </p>
      <section className="nua-card" aria-labelledby="timeline">
        <h2 id="timeline">Timeline</h2>
        <ol>
          {app.events.map((e) => (
            <li key={e.id}>
              <strong>{EVENT_COPY[e.event_type] ?? e.event_type}</strong>
              {e.to_status ? (
                <>
                  {' '}
                  → <StatusBadge status={e.to_status} />
                </>
              ) : null}{' '}
              <time dateTime={e.created_at} className="nua-muted">
                {new Date(e.created_at).toLocaleString('en-AU')}
              </time>
            </li>
          ))}
        </ol>
        <p className="nua-hint">
          Only actions recorded in NUA CREW appear here. Decisions are made by people at the
          employer.
        </p>
      </section>
      {!terminal ? (
        <form action={withdraw}>
          <input type="hidden" name="application_id" value={app.id} />
          <Button type="submit" variant="danger">
            Withdraw application
          </Button>
        </form>
      ) : null}
    </div>
  );
}
