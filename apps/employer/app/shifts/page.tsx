import { Button, ShiftSummary, ShiftHistory, TimesheetSummary } from '@nua-crew/ui';
import { api, canWrite, requireEmployer } from '@/lib/api';
import { shiftAction, reviewCorrection } from './actions';
export default async function Shifts({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; notice?: string }>;
}) {
  const { employerId, role } = await requireEmployer();
  const flash = await searchParams;
  const client = await api();
  const params = { path: { employer_id: employerId } };
  const [shifts, bookings, jobs, threads] = await Promise.all([
    client.GET('/v1/employers/{employer_id}/shifts', { params }),
    client.GET('/v1/employers/{employer_id}/shift-bookings', { params }),
    client.GET('/v1/employers/{employer_id}/jobs', { params }),
    client.GET('/v1/employers/{employer_id}/conversations', { params }),
  ]);
  const write = canWrite(role);
  return (
    <div className="nua-stack">
      <h1>Shifts &amp; hours</h1>
      <p>
        Clear offers, confirmed places and reviewed hours. Employees choose whether to accept each
        offer.
      </p>
      {flash.error ? <p role="alert">{flash.error}</p> : null}
      {flash.notice ? <p role="status">{flash.notice}</p> : null}
      {write ? (
        <details className="nua-card">
          <summary>Create a shift</summary>
          <form action={shiftAction} className="nua-stack">
            <input name="action" type="hidden" value="create" />
            {jobs.error ? <p role="alert">Jobs could not load. Reload to retry.</p> : null}
            <label>
              Published hourly job
              <select name="job" required>
                <option value="">Choose a job</option>
                {jobs.data
                  ?.filter((j) => j.status === 'published' && j.pay_period === 'hour')
                  .map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title} · A${j.pay_min}–{j.pay_max}/hour
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Venue date
              <input type="date" name="date" required />
            </label>
            <label>
              Start
              <input type="time" name="start" required />
            </label>
            <label>
              End
              <input type="time" name="end" required />
            </label>
            <label>
              Venue time zone
              <select name="zone" defaultValue="Australia/Melbourne">
                {[
                  'Australia/Melbourne',
                  'Australia/Sydney',
                  'Australia/Brisbane',
                  'Australia/Adelaide',
                  'Australia/Perth',
                  'Australia/Hobart',
                  'Australia/Darwin',
                  'Australia/Lord_Howe',
                ].map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </label>
            <label>
              Places
              <input type="number" name="capacity" min="1" max="50" defaultValue="1" required />
            </label>
            <label>
              Hourly rate (AUD)
              <input name="rate" type="number" min="0.01" step="0.01" required />
            </label>
            <p className="nua-hint">
              Use a rate within the advertised range. Super treatment follows the job. End before
              start means the next day. Ambiguous daylight-saving times require another time.
            </p>
            <label>
              <input name="confirm" type="checkbox" required /> I confirm the time, pay and places.
            </label>
            <Button type="submit">Create shift</Button>
          </form>
        </details>
      ) : null}
      <h2>Scheduled shifts</h2>
      {shifts.error ? (
        <p role="alert">Shifts could not load. Reload to retry.</p>
      ) : !shifts.data?.length ? (
        <p>No shifts yet.</p>
      ) : (
        shifts.data.map((s) => (
          <article key={s.id} className="nua-card nua-stack">
            <ShiftSummary shift={s} />
            <p>
              {s.status} ·{' '}
              {bookings.error
                ? 'Confirmed count unavailable'
                : `${bookings.data?.filter((b) => b.shift.id === s.id && b.status === 'confirmed').length ?? 0} / ${s.capacity} confirmed`}
            </p>
            {write && s.status === 'open' && new Date(s.starts_at).getTime() > Date.now() ? (
              <>
                {threads.error ? (
                  <p role="alert">Conversations could not load. Reload to retry.</p>
                ) : (
                  <form action={shiftAction} className="nua-stack">
                    <input name="action" type="hidden" value="offer" />
                    <input name="shift" type="hidden" value={s.id} />
                    <label>
                      Accepted temporary-work conversation
                      <select name="conversation" required>
                        <option value="">Choose a conversation</option>
                        {threads.data
                          ?.filter((c) => c.job_id === s.job_id && c.status === 'open')
                          .map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.counterpart}
                            </option>
                          ))}
                      </select>
                    </label>
                    <label>
                      <input name="confirm" type="checkbox" required /> Send this offer. It does not
                      reserve a place.
                    </label>
                    <Button type="submit">Send offer</Button>
                  </form>
                )}
                <details>
                  <summary>Cancel shift</summary>
                  <form action={shiftAction} className="nua-stack">
                    <input name="action" type="hidden" value="cancel" />
                    <input name="shift" type="hidden" value={s.id} />
                    <label>
                      Reason
                      <input name="reason" minLength={3} maxLength={1000} required />
                    </label>
                    <label>
                      <input name="confirm" type="checkbox" required /> Cancel offers and bookings
                      and release calendar commitments.
                    </label>
                    <Button type="submit" variant="danger">
                      Cancel shift
                    </Button>
                  </form>
                </details>
              </>
            ) : null}
          </article>
        ))
      )}
      <h2>Offers &amp; hours review</h2>
      {bookings.error ? (
        <p role="alert">Bookings could not load. Reload to retry.</p>
      ) : !bookings.data?.length ? (
        <p>No bookings yet.</p>
      ) : (
        bookings.data.map((b) => (
          <article key={b.id} className="nua-card nua-stack">
            <h3>
              {b.candidate_label} · {b.shift.title}
            </h3>
            <p>
              {b.status}
              {b.reason ? ` · ${b.reason}` : ''}
            </p>
            {b.timesheet ? <TimesheetSummary sheet={b.timesheet} /> : <p>Hours not submitted.</p>}
            {write && b.timesheet?.status === 'submitted' ? (
              <form action={shiftAction} className="nua-stack">
                <input name="booking" type="hidden" value={b.id} />
                <input name="version" type="hidden" value={b.timesheet.version} />
                <label>
                  Review decision
                  <select name="action">
                    <option value="approved">Approve hours</option>
                    <option value="disputed">Request correction / dispute</option>
                  </select>
                </label>
                <label>
                  Review note
                  <textarea name="reason" minLength={3} maxLength={1000} required />
                </label>
                <label>
                  <input name="confirm" type="checkbox" required /> I reviewed this version of the
                  hours. This does not process wages.
                </label>
                <Button type="submit">Record review</Button>
              </form>
            ) : null}
            {write && b.status === 'confirmed'
              ? b.attendance?.events
                  .filter(
                    (e) =>
                      e.kind === 'correction_requested' &&
                      !b.attendance?.events.some(
                        (d) =>
                          d.ref_event_id === e.id &&
                          ['correction_approved', 'correction_rejected'].includes(d.kind),
                      ),
                  )
                  .map((e) => (
                    <form key={e.id} action={reviewCorrection} className="nua-card nua-stack">
                      <h4>Attendance correction waiting</h4>
                      <p>
                        {e.claim_kind?.replaceAll('_', ' ')} ·{' '}
                        {e.claimed_at
                          ? new Intl.DateTimeFormat('en-AU', {
                              dateStyle: 'medium',
                              timeStyle: 'short',
                              timeZone: b.shift.time_zone,
                            }).format(new Date(e.claimed_at))
                          : 'Time unavailable'}{' '}
                        · {b.shift.time_zone}
                      </p>
                      <p>{e.note}</p>
                      <input name="booking" type="hidden" value={b.id} />
                      <input name="event" type="hidden" value={e.id} />
                      <label>
                        Decision
                        <select name="decision">
                          <option value="approved">Approve correction</option>
                          <option value="rejected">Reject correction</option>
                        </select>
                      </label>
                      <label>
                        Review reason
                        <input name="reason" required minLength={3} maxLength={1000} />
                      </label>
                      <label>
                        <input name="confirm" type="checkbox" required /> Record this decision and
                        share it with the worker.
                      </label>
                      <Button type="submit">Review attendance</Button>
                    </form>
                  ))
              : null}
            <ShiftHistory booking={b} />
          </article>
        ))
      )}
    </div>
  );
}
