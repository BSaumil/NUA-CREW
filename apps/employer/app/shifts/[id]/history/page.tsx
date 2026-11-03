import { api, requireEmployer } from '@/lib/api';
export default async function History({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ zone?: string }>;
}) {
  const query = await searchParams;
  let zone = query.zone ?? 'UTC';
  try {
    new Intl.DateTimeFormat('en-AU', { timeZone: zone }).format();
  } catch {
    zone = 'UTC';
  }
  const format = (value: string) =>
    new Intl.DateTimeFormat('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: zone,
    }).format(new Date(value));
  const { employerId } = await requireEmployer();
  const { id } = await params;
  const r = await (
    await api()
  ).GET('/v1/employers/{employer_id}/shift-bookings/{booking_id}/timesheet-history', {
    params: { path: { employer_id: employerId, booking_id: id } },
  });
  return (
    <div className="nua-stack">
      <h1>Hours version history</h1>
      <a href="/shifts">Back to shifts</a>
      {r.error ? (
        <p role="alert">
          This history is unavailable. <a href={`/shifts/${id}/history`}>Try again</a>.
        </p>
      ) : !r.data?.length ? (
        <p>No hours submitted yet.</p>
      ) : (
        r.data.map((v) => (
          <article className="nua-card" key={v.version}>
            <h2>
              Version {v.version} · {v.status}
            </h2>
            <p>
              {v.worked_minutes} worked minutes · {v.break_minutes} unpaid break minutes
            </p>
            <p>
              {format(v.starts_at)} – {format(v.ends_at)} · {zone}
            </p>
            <p>
              Recorded {format(v.recorded_at)} · {zone}
            </p>
            {v.note ? <p>{v.note}</p> : null}
            {v.review_note ? <p>{v.review_note}</p> : null}
          </article>
        ))
      )}
    </div>
  );
}
