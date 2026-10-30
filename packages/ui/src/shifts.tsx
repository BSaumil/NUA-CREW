export type ShiftView = {
  title: string;
  starts_at: string;
  ends_at: string;
  time_zone: string;
  hourly_rate_minor: number;
  super_included: boolean;
};
export const venueTime = (value: string, zone: string) =>
  new Intl.DateTimeFormat('en-AU', {
    timeZone: zone,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));

export function ShiftSummary({ shift }: { shift: ShiftView }) {
  return (
    <div className="nua-stack">
      <h2>{shift.title}</h2>
      <p>
        {venueTime(shift.starts_at, shift.time_zone)} – {venueTime(shift.ends_at, shift.time_zone)}
      </p>
      <span className="nua-badge">{shift.time_zone}</span>
      <p>
        <strong>A${(shift.hourly_rate_minor / 100).toFixed(2)} / hour</strong> ·{' '}
        {shift.super_included ? 'including super' : 'plus super'}
      </p>
    </div>
  );
}
export type SheetView = {
  status: string;
  version: number;
  worked_minutes: number;
  break_minutes: number;
  review_note?: string | null;
};
export function TimesheetSummary({ sheet }: { sheet: SheetView }) {
  return (
    <div className="nua-alert">
      <strong>
        Hours · {sheet.status} · version {sheet.version}
      </strong>
      <p>
        {sheet.worked_minutes} worked minutes · {sheet.break_minutes} unpaid break minutes
      </p>
      {sheet.review_note ? <p>{sheet.review_note}</p> : null}
      <p className="nua-hint">Hours review does not process wages.</p>
    </div>
  );
}
export function ShiftHistory({
  booking,
}: {
  booking: {
    id: string;
    shift: ShiftView;
    attendance?: {
      status: string;
      check_in_at?: string | null;
      check_out_at?: string | null;
      events: { id: string; kind: string; recorded_at: string; note?: string | null }[];
    } | null;
  };
}) {
  const a = booking.attendance;
  return (
    <details className="nua-card">
      <summary>Attendance &amp; revision history</summary>
      <p>
        {a?.status.replaceAll('_', ' ') ?? 'Not recorded'} · {booking.shift.time_zone}
      </p>
      <dl>
        <dt>Check-in</dt>
        <dd>
          {a?.check_in_at ? venueTime(a.check_in_at, booking.shift.time_zone) : 'Not recorded'}
        </dd>
        <dt>Check-out</dt>
        <dd>
          {a?.check_out_at ? venueTime(a.check_out_at, booking.shift.time_zone) : 'Not recorded'}
        </dd>
      </dl>
      <ol>
        {a?.events.map((e) => (
          <li key={e.id}>
            {e.kind.replaceAll('_', ' ')} · {venueTime(e.recorded_at, booking.shift.time_zone)}
            {e.note ? ` · ${e.note}` : ''}
          </li>
        ))}
      </ol>
      <a href={`/shifts/${booking.id}/history?zone=${encodeURIComponent(booking.shift.time_zone)}`}>
        View every hours version
      </a>
    </details>
  );
}
