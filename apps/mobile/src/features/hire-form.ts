import type { Schemas } from '@nua-crew/contracts';

function validDate(value: string): boolean {
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(timestamp) &&
    new Date(timestamp).toISOString().slice(0, 10) === value
  );
}

export function validateWorkWindow(date: string, start: string, end: string): string | null {
  if (!date && !start && !end) return null;
  if (!validDate(date)) return 'Enter a real work date in YYYY-MM-DD format.';
  if (![start, end].every((v) => /^([01]\d|2[0-3]):[0-5]\d$/.test(v)))
    return 'Enter both start and end in 24-hour time, from 00:00 to 23:59.';
  if (start === end) return 'Start and end must differ. An earlier end runs overnight.';
  return null;
}

export function validateJob(body: Schemas['JobIn'], step: number): string | null {
  if (!body.title.trim()) return 'Add a job title, such as Barista or Chef.';
  if (!body.location_id) return 'Choose a work location. Add one in Business if needed.';
  if (!body.description.trim()) return 'Tell people what the role involves.';
  if (body.skills && body.skills.length > 30) return 'Choose up to 30 relevant skills.';
  for (const value of [body.min_weekly_hours, body.max_weekly_hours]) {
    if (
      value != null &&
      (!Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 168)
    )
      return 'Weekly hours must be between 0 and 168.';
  }
  if (
    body.min_weekly_hours != null &&
    body.max_weekly_hours != null &&
    Number(body.min_weekly_hours) > Number(body.max_weekly_hours)
  )
    return 'Maximum weekly hours must be at least the minimum.';
  if (
    (body.start_date && !validDate(body.start_date)) ||
    (body.end_date && !validDate(body.end_date))
  )
    return 'Use a real date in YYYY-MM-DD format.';
  if (body.start_date && body.end_date && body.start_date > body.end_date)
    return 'End date must be on or after the start date.';
  if (step >= 1) {
    const lo = Number(body.pay_min);
    const hi = Number(body.pay_max);
    if (
      !body.pay_min ||
      !body.pay_max ||
      !Number.isFinite(lo) ||
      !Number.isFinite(hi) ||
      lo <= 0 ||
      hi <= 0
    )
      return 'Enter a positive minimum and maximum pay amount.';
    if (hi < lo)
      return 'Maximum pay must be at least the minimum. Use the same amount for a fixed rate.';
    if (body.super_included == null) return 'State whether super is included or paid on top.';
  }
  return null;
}

export const APPLICATION_STAGE: Record<string, string> = {
  submitted: 'New',
  under_review: 'Reviewing',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Not progressing',
  withdrawn: 'Withdrawn',
};
