import { Button, ShiftSummary, ShiftHistory, TimesheetSummary } from '@nua-crew/ui';
import { api, requireCandidate } from '@/lib/api';
import { bookingAction, submitHours, requestCorrection } from './actions';
function parts(value: string, zone: string) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(value));
  const get = (k: string) => p.find((v) => v.type === k)?.value;
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    time: `${get('hour')}:${get('minute')}`,
  };
}
export default async function Shifts({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  await requireCandidate();
  const flash = await searchParams;
  const { data, error } = await (await api()).GET('/v1/candidate/shift-bookings');
  const now = Date.now();
  return (
    <div className="nua-stack">
      <h1>Your shifts</h1>
      <p>
        Review the time, venue time zone and pay before accepting. An offer does not hold a place.
      </p>
      {flash.error ? <p role="alert">{flash.error}</p> : null}
      {flash.notice ? <p role="status">{flash.notice}</p> : null}
      {error ? (
        <p role="alert">Shifts could not load. Reload to retry.</p>
      ) : !data?.length ? (
        <p>No shift offers yet. Accepted temporary-work conversations can lead to offers here.</p>
      ) : (
        data.map((b) => {
          const future = new Date(b.shift.starts_at).getTime() > now;
          const start = parts(b.timesheet?.starts_at ?? b.shift.starts_at, b.shift.time_zone);
          const end = parts(b.timesheet?.ends_at ?? b.shift.ends_at, b.shift.time_zone);
          const actions =
            b.status === 'offered' && new Date(b.expires_at).getTime() > now
              ? ['accept', 'decline']
              : b.status === 'confirmed'
                ? [
                    ...(future ? ['cancel'] : []),
                    ...(b.attendance?.status !== 'no_show' && !b.attendance?.check_out_at
                      ? [b.attendance?.check_in_at ? 'check_out' : 'check_in']
                      : []),
                  ]
                : [];
          return (
            <article key={b.id} className="nua-card nua-stack">
              <ShiftSummary shift={b.shift} />
              <p>
                <strong>{b.status}</strong>
                {b.reason ? ` · ${b.reason}` : ''}
              </p>
              {actions.length ? (
                <form action={bookingAction} className="nua-stack">
                  <input type="hidden" name="booking_id" value={b.id} />
                  <label>
                    Decision
                    <select name="action">
                      {actions.map((a) => (
                        <option key={a} value={a}>
                          {a.replaceAll('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </label>
                  {future && b.status === 'confirmed' ? (
                    <label>
                      Cancellation reason
                      <input name="reason" maxLength={1000} />
                    </label>
                  ) : null}
                  <label>
                    <input name="confirm" type="checkbox" required /> I confirm this action.
                    Attendance records the current server time; it does not verify my location.
                  </label>
                  <Button type="submit">Confirm decision</Button>
                </form>
              ) : null}
              {b.timesheet ? <TimesheetSummary sheet={b.timesheet} /> : null}
              {b.status === 'confirmed' &&
              new Date(b.shift.ends_at).getTime() <= now &&
              b.attendance?.status !== 'no_show' &&
              b.timesheet?.status !== 'approved' ? (
                <details>
                  <summary>Submit or correct actual hours</summary>
                  <form action={submitHours} className="nua-stack">
                    <input name="booking_id" type="hidden" value={b.id} />
                    <input name="version" type="hidden" value={b.timesheet?.version ?? 0} />
                    <input name="zone" type="hidden" value={b.shift.time_zone} />
                    <p>
                      Use {b.shift.time_zone}. An end time before the start means the following day.
                      A no-show mark needs attendance review before hours can be submitted.
                    </p>
                    <label>
                      Work date
                      <input name="date" type="date" required defaultValue={start.date} />
                    </label>
                    <label>
                      Actual start
                      <input name="start" type="time" required defaultValue={start.time} />
                    </label>
                    <label>
                      Actual end
                      <input name="end" type="time" required defaultValue={end.time} />
                    </label>
                    <label>
                      Unpaid break minutes
                      <input
                        name="break"
                        type="number"
                        min="0"
                        max="1439"
                        step="1"
                        required
                        defaultValue={b.timesheet?.break_minutes ?? 0}
                      />
                    </label>
                    <label>
                      Correction or hours note
                      <textarea name="note" maxLength={1000} />
                    </label>
                    <label>
                      <input name="confirm" type="checkbox" required /> These are my actual hours
                      for employer review.
                    </label>
                    <Button type="submit">Submit hours</Button>
                  </form>
                </details>
              ) : null}
              {b.attendance?.status === 'no_show' ? (
                <p role="alert">
                  The business marked a no-show. Request a check-in correction if this is wrong.
                </p>
              ) : null}
              {b.status === 'confirmed' && b.shift.status === 'open' ? (
                <details>
                  <summary>Request an attendance correction</summary>
                  <form action={requestCorrection} className="nua-stack">
                    <input type="hidden" name="booking_id" value={b.id} />
                    <p>
                      Enter the actual date and time in {b.shift.time_zone}. The business reviews
                      this request.
                    </p>
                    <label>
                      Event
                      <select name="kind">
                        <option value="check_in">Check-in</option>
                        <option value="check_out">Check-out</option>
                      </select>
                    </label>
                    <label>
                      Correction date
                      <input type="date" name="date" defaultValue={start.date} required />
                    </label>
                    <label>
                      Correction time
                      <input type="time" name="time" defaultValue={start.time} required />
                    </label>
                    <label>
                      Reason
                      <input name="reason" required minLength={3} maxLength={1000} />
                    </label>
                    <label>
                      <input name="confirm" type="checkbox" required /> I confirm this correction
                      request.
                    </label>
                    <Button type="submit">Send correction for review</Button>
                  </form>
                </details>
              ) : null}
              <ShiftHistory booking={b} />
            </article>
          );
        })
      )}
    </div>
  );
}
