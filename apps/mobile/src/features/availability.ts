import type { Schemas } from '@nua-crew/contracts';

export type Rule = { weekday: number; start_time: string; end_time: string };
export type WorkKind = 'permanent' | 'temporary';
export type WorkPreference = Schemas['WorkPreferenceOut'];

/** Monday = 0, matching the API. */
export const WEEKDAYS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
] as const;

export const ZONES = [
  ['Australia/Melbourne', 'Melbourne'],
  ['Australia/Sydney', 'Sydney'],
  ['Australia/Brisbane', 'Brisbane'],
  ['Australia/Adelaide', 'Adelaide'],
  ['Australia/Perth', 'Perth'],
  ['Australia/Hobart', 'Hobart'],
  ['Australia/Darwin', 'Darwin'],
] as const;

/** Accepts 9, 9:30, 09:30, 17:00, 9am, 9:30 pm. Returns "HH:MM" (24 h) or null. */
export function parseTime(input: string): string | null {
  const m = /^\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\s*$/i.exec(input);
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2] === undefined ? 0 : Number(m[2]);
  const suffix = m[3]?.toLowerCase();
  if (min > 59) return null;
  if (suffix) {
    if (h < 1 || h > 12) return null;
    h = (h % 12) + (suffix === 'pm' ? 12 : 0);
  } else if (h > 23) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

/** Accepts 2026-11-03 or 3/11/2026 (day first, as in Australia). Returns ISO date or null. */
export function parseDate(input: string): string | null {
  const t = input.trim();
  let y: number, mo: number, d: number;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t);
  if (m) [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(t)))
    [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else return null;
  const date = new Date(Date.UTC(y, mo - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d)
    return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

export function formatTime(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2));
  const m = Number(hhmm.slice(3, 5));
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${suffix}`;
}

export const isOvernight = (start: string, end: string) => end <= start;

export function describeWindow(start: string, end: string): string {
  const base = `${formatTime(start.slice(0, 5))} to ${formatTime(end.slice(0, 5))}`;
  return isOvernight(start.slice(0, 5), end.slice(0, 5)) ? `${base} (next day)` : base;
}

export function formatDate(iso: string): string {
  const y = iso.slice(0, 4);
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  return `${d}/${m}/${y}`;
}

const minutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/** Minutes-of-week span for a rule; overnight windows run into the next day (and Sunday into Monday). */
function span(r: Rule): [number, number] {
  const s = r.weekday * 1440 + minutes(r.start_time);
  const len = (minutes(r.end_time) - minutes(r.start_time) + 1440) % 1440 || 1440;
  return [s, s + len];
}

/** Same rule as the server: windows must not overlap, including overnight spill and week wrap. */
export function windowsOverlap(rules: Rule[]): boolean {
  const week = 7 * 1440;
  const spans = rules.map(span);
  for (let i = 0; i < spans.length; i++)
    for (let j = i + 1; j < spans.length; j++) {
      const [a0, a1] = spans[i]!;
      const [b0, b1] = spans[j]!;
      for (const shift of [0, week, -week]) if (a0 < b1 + shift && b0 + shift < a1) return true;
    }
  return false;
}

export function windowError(
  startRaw: string,
  endRaw: string,
  existing: Rule[],
  weekday: number,
): { start?: string; end?: string; form?: string; value?: Rule } {
  const start = parseTime(startRaw);
  const end = parseTime(endRaw);
  const out: { start?: string; end?: string; form?: string; value?: Rule } = {};
  if (!start) out.start = 'Enter a time like 9:00 am or 17:30';
  if (!end) out.end = 'Enter a time like 5:00 pm or 22:00';
  if (!start || !end) return out;
  if (start === end) {
    out.end = 'Start and end must be different';
    return out;
  }
  const rule = { weekday, start_time: start, end_time: end };
  if (windowsOverlap([...existing, rule])) {
    out.form = 'That overlaps another window. Edit or remove the other one first.';
    return out;
  }
  out.value = rule;
  return out;
}

export const sortRules = (rules: Rule[]) =>
  [...rules].sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));

export const rulesOfDay = (rules: Rule[], weekday: number) =>
  sortRules(rules).filter((r) => r.weekday === weekday);

/** Same shape the API sends back ("HH:MM:SS") reduced to "HH:MM". */
export const normalise = (rules: Rule[]): Rule[] =>
  rules.map((r) => ({
    weekday: r.weekday,
    start_time: r.start_time.slice(0, 5),
    end_time: r.end_time.slice(0, 5),
  }));

export const sameRules = (a: Rule[], b: Rule[]) =>
  JSON.stringify(sortRules(normalise(a))) === JSON.stringify(sortRules(normalise(b)));

// ---- work preferences form ----
export type PrefForm = {
  enabled: boolean;
  engagement: string[];
  hours: string[];
  minWeekly: string;
  maxWeekly: string;
  minPay: string;
  maxTravel: string;
  notice: string;
  availableFrom: string;
};

export const emptyPref = (): PrefForm => ({
  enabled: false,
  engagement: [],
  hours: [],
  minWeekly: '',
  maxWeekly: '',
  minPay: '',
  maxTravel: '',
  notice: '',
  availableFrom: '',
});

const trimNum = (v: string | null | undefined) =>
  v == null ? '' : String(Number(v)).replace(/^NaN$/, '');

export function prefToForm(p: WorkPreference | null | undefined): PrefForm {
  if (!p) return emptyPref();
  return {
    enabled: p.enabled,
    engagement: [...p.engagement_bases],
    hours: [...p.hours_patterns],
    minWeekly: trimNum(p.min_weekly_hours),
    maxWeekly: trimNum(p.max_weekly_hours),
    minPay: p.min_hourly_pay == null ? '' : Number(p.min_hourly_pay).toFixed(2),
    maxTravel: p.max_travel_km == null ? '' : String(p.max_travel_km),
    notice: p.notice_period_days == null ? '' : String(p.notice_period_days),
    availableFrom: p.available_from ? formatDate(p.available_from) : '',
  };
}

export type PrefErrors = Partial<Record<keyof PrefForm, string>>;

const num = (v: string) => (v.trim() === '' ? null : Number(v.replace(/,/g, '')));

export function validatePref(
  f: PrefForm,
  kind: WorkKind,
): { errors: PrefErrors; body?: Schemas['WorkPreferenceIn'] } {
  const e: PrefErrors = {};
  const minW = num(f.minWeekly);
  const maxW = num(f.maxWeekly);
  const pay = num(f.minPay);
  const travel = num(f.maxTravel);
  const notice = num(f.notice);
  if (minW !== null && (!Number.isFinite(minW) || minW < 0 || minW > 168))
    e.minWeekly = 'Enter hours between 0 and 168';
  if (maxW !== null && (!Number.isFinite(maxW) || maxW < 0 || maxW > 168))
    e.maxWeekly = 'Enter hours between 0 and 168';
  if (!e.minWeekly && !e.maxWeekly && minW !== null && maxW !== null && minW > maxW)
    e.maxWeekly = 'Maximum must be at least the minimum';
  if (pay !== null && (!Number.isFinite(pay) || pay < 0 || pay > 1000))
    e.minPay = 'Enter a dollar amount per hour';
  if (
    kind === 'temporary' &&
    travel !== null &&
    (!Number.isInteger(travel) || travel < 1 || travel > 500)
  )
    e.maxTravel = 'Enter whole kilometres from 1 to 500';
  if (
    kind === 'permanent' &&
    notice !== null &&
    (!Number.isInteger(notice) || notice < 0 || notice > 365)
  )
    e.notice = 'Enter whole days from 0 to 365';
  let from: string | null = null;
  if (kind === 'permanent' && f.availableFrom.trim()) {
    from = parseDate(f.availableFrom);
    if (!from) e.availableFrom = 'Use a date like 1/2/2027';
  }
  if (Object.keys(e).length) return { errors: e };
  return {
    errors: e,
    body: {
      enabled: f.enabled,
      engagement_bases: f.engagement as ('employee' | 'contractor')[],
      hours_patterns: f.hours as ('full_time' | 'part_time' | 'casual')[],
      min_weekly_hours: minW === null ? null : String(minW),
      max_weekly_hours: maxW === null ? null : String(maxW),
      min_hourly_pay: pay === null ? null : pay.toFixed(2),
      max_travel_km: kind === 'temporary' ? travel : null,
      notice_period_days: kind === 'permanent' ? notice : null,
      available_from: kind === 'permanent' ? from : null,
    },
  };
}

export type Mode = 'permanent' | 'temporary' | 'both' | 'none';
export const modeOf = (perm: boolean, temp: boolean): Mode =>
  perm && temp ? 'both' : perm ? 'permanent' : temp ? 'temporary' : 'none';

export const EXCEPTION_LABEL = { available: 'Available', unavailable: 'Not available' } as const;
