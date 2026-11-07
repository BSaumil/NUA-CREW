import type { Metadata } from 'next';
import { Button } from '@nua-crew/ui';
import { api, requireCandidate } from '@/lib/api';
import {
  addAvailabilityException,
  deleteAvailabilityException,
  saveAvailability,
} from '../actions';
import { Flash, flashFrom } from '../components';

export const metadata: Metadata = { title: 'Your availability', robots: { index: false } };

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ZONES = [
  'Australia/Melbourne',
  'Australia/Sydney',
  'Australia/Brisbane',
  'Australia/Adelaide',
  'Australia/Perth',
  'Australia/Hobart',
  'Australia/Darwin',
];
const EXTRA_ROWS = 2;
const hhmm = (t: string) => t.slice(0, 5);

export default async function Availability({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCandidate();
  const { error, notice } = await flashFrom(searchParams);
  const { data, error: loadError } = await (await api()).GET('/v1/candidate/availability');
  if (loadError || !data)
    return (
      <p role="alert">
        We couldn’t load your availability. <a href="/availability">Try again</a>.
      </p>
    );
  const zones = ZONES.includes(data.time_zone) ? ZONES : [data.time_zone, ...ZONES];
  return (
    <div className="nua-stack" style={{ maxWidth: 760 }}>
      <h1>When can you work?</h1>
      <p>
        Your weekly pattern says when you are usually free. It is private: employers only see
        whether you are available, not your calendar, and only if you have chosen to be
        discoverable. Anything you have not set is shown as <strong>unknown</strong>, never as
        available.
      </p>
      <Flash error={error} notice={notice} />

      <form action={saveAvailability} className="nua-stack" aria-labelledby="week-h">
        <h2 id="week-h">Weekly pattern</h2>
        <div className="nua-field">
          <label htmlFor="time_zone">Time zone</label>
          <select id="time_zone" name="time_zone" defaultValue={data.time_zone}>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace('Australia/', '')}
              </option>
            ))}
          </select>
        </div>
        {DAYS.map((name, weekday) => {
          const mine = data.rules.filter((r) => r.weekday === weekday);
          const rows = [
            ...mine.map((r) => [hhmm(r.start_time), hhmm(r.end_time)]),
            ...Array(EXTRA_ROWS).fill(['', '']),
          ];
          return (
            <fieldset key={name} className="nua-card nua-stack">
              <legend>{name}</legend>
              {rows.map(([s, e], i) => (
                <div key={i} className="nua-row">
                  <div className="nua-field">
                    <label htmlFor={`s-${weekday}-${i}`}>
                      {name} window {i + 1} from
                    </label>
                    <input
                      id={`s-${weekday}-${i}`}
                      name={`win_${weekday}_${i}_s`}
                      type="time"
                      defaultValue={s}
                    />
                  </div>
                  <div className="nua-field">
                    <label htmlFor={`e-${weekday}-${i}`}>
                      {name} window {i + 1} to
                    </label>
                    <input
                      id={`e-${weekday}-${i}`}
                      name={`win_${weekday}_${i}_e`}
                      type="time"
                      defaultValue={e}
                    />
                  </div>
                </div>
              ))}
            </fieldset>
          );
        })}
        <p className="nua-hint">
          Clear both times to remove a window. An end at or before the start runs overnight into the
          next day. Windows on the same day must not overlap.
        </p>
        <p>
          <Button type="submit">Save weekly pattern</Button>
          {data.weekly_hours != null ? (
            <span className="nua-hint"> About {data.weekly_hours} hours a week.</span>
          ) : null}
        </p>
      </form>

      <section className="nua-stack" aria-labelledby="exc-h">
        <h2 id="exc-h">Exceptions</h2>
        <p>One-off days or times that differ from your pattern: a holiday, or an extra day.</p>
        {data.exceptions.length === 0 ? (
          <p className="nua-hint">No exceptions.</p>
        ) : (
          <ul className="nua-stack" aria-label="Exceptions">
            {data.exceptions.map((x) => {
              const label = `${x.state === 'available' ? 'Available' : 'Unavailable'} ${x.start_date}${
                x.end_date !== x.start_date ? ` to ${x.end_date}` : ''
              }${x.start_time && x.end_time ? `, ${hhmm(x.start_time)}–${hhmm(x.end_time)}` : ', all day'}`;
              return (
                <li key={x.id} className="nua-card nua-row">
                  <span>{label}</span>
                  <form action={deleteAvailabilityException}>
                    <input type="hidden" name="id" value={x.id} />
                    <Button type="submit" variant="secondary">
                      Remove<span className="nua-sr-only"> {label}</span>
                    </Button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
        <form
          action={addAvailabilityException}
          className="nua-card nua-stack"
          aria-label="Add an exception"
        >
          <div className="nua-grid">
            <div className="nua-field">
              <label htmlFor="x-state">I am</label>
              <select id="x-state" name="state" defaultValue="unavailable">
                <option value="unavailable">Unavailable</option>
                <option value="available">Available</option>
              </select>
            </div>
            <div className="nua-field">
              <label htmlFor="x-from">From date</label>
              <input id="x-from" name="start_date" type="date" required />
            </div>
            <div className="nua-field">
              <label htmlFor="x-to">To date (optional)</label>
              <input id="x-to" name="end_date" type="date" />
            </div>
            <div className="nua-field">
              <label htmlFor="x-st">From time (optional)</label>
              <input id="x-st" name="start_time" type="time" />
            </div>
            <div className="nua-field">
              <label htmlFor="x-et">To time (optional)</label>
              <input id="x-et" name="end_time" type="time" />
            </div>
          </div>
          <p className="nua-hint">Leave the times empty for the whole day.</p>
          <p>
            <Button type="submit" variant="secondary">
              Add exception
            </Button>
          </p>
        </form>
      </section>
    </div>
  );
}
