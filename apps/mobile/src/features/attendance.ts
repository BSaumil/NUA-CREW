/**
 * Attendance rules the screens rely on. They mirror `services/api/app/routers/attendance.py`; the
 * server is the authority and re-checks every one, so these only decide which buttons to offer.
 */
import type { Schemas } from '@nua-crew/contracts';

const HOUR = 3_600_000;
export const EARLY_CHECK_IN_MS = HOUR;
export const NO_SHOW_GRACE_MS = 30 * 60_000;
export const CORRECTION_WINDOW_MS = 12 * HOUR;

type Shift = Pick<Schemas['ShiftOut'], 'starts_at' | 'ends_at' | 'time_zone'>;
type Attendance = Schemas['AttendanceOut'] | null | undefined;

export type CheckInState = 'checked_in' | 'too_early' | 'open' | 'closed';

/** Check in opens one hour before the shift and closes when it ends. */
export function checkInState(shift: Shift, attendance: Attendance, now: number): CheckInState {
  if (attendance?.check_in_at) return 'checked_in';
  const start = new Date(shift.starts_at).getTime();
  const end = new Date(shift.ends_at).getTime();
  if (now < start - EARLY_CHECK_IN_MS) return 'too_early';
  if (now > end) return 'closed';
  return 'open';
}

/** Check out needs a check in first and stays open for 12 hours after the shift ends. */
export function canCheckOut(shift: Shift, attendance: Attendance, now: number): boolean {
  if (!attendance?.check_in_at || attendance.check_out_at) return false;
  if (attendance.status === 'no_show') return false;
  return now <= new Date(shift.ends_at).getTime() + CORRECTION_WINDOW_MS;
}

export function canCheckIn(shift: Shift, attendance: Attendance, now: number): boolean {
  return attendance?.status !== 'no_show' && checkInState(shift, attendance, now) === 'open';
}

/** Employers may mark a no-show only after the grace period and only if nobody checked in. */
export function canMarkNoShow(shift: Shift, attendance: Attendance, now: number): boolean {
  if (attendance?.check_in_at || attendance?.status === 'no_show') return false;
  return now >= new Date(shift.starts_at).getTime() + NO_SHOW_GRACE_MS;
}

export function clock(value: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-AU', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value));
}

/** One plain sentence about where attendance stands, in the venue time zone. */
export function attendanceLine(attendance: Attendance, timeZone: string): string {
  if (!attendance || attendance.status === 'not_started') return 'Not checked in yet.';
  if (attendance.status === 'no_show')
    return 'The business marked this shift as a no-show. You can ask them to review it.';
  const inAt = attendance.check_in_at ? clock(attendance.check_in_at, timeZone) : null;
  const outAt = attendance.check_out_at ? clock(attendance.check_out_at, timeZone) : null;
  if (attendance.status === 'checked_out') return `Checked in ${inAt}, checked out ${outAt}.`;
  return `Checked in ${inAt}.`;
}

/**
 * The instant at which `date` (YYYY-MM-DD) and `time` (HH:MM) show on a wall clock in `timeZone`,
 * as an ISO string with a UTC offset. Returns null for a malformed or non-existent local time.
 */
export function instantFromLocal(date: string, time: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  if (!m || !t) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const [h, mi] = [Number(t[1]), Number(t[2])];
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  const asLocal = (ms: number) => {
    const p = new Intl.DateTimeFormat('en-AU', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(new Date(ms));
    const g = (k: Intl.DateTimeFormatPartTypes) => Number(p.find((x) => x.type === k)!.value);
    return Date.UTC(g('year'), g('month') - 1, g('day'), g('hour'), g('minute'));
  };
  // Two passes settle on the right offset across a daylight-saving change.
  let guess = wall;
  for (let i = 0; i < 2; i++) guess = wall - (asLocal(guess) - guess);
  if (asLocal(guess) !== wall) return null; // the clock never showed this time (spring forward)
  return new Date(guess).toISOString();
}

export type CorrectionKind = 'check_in' | 'check_out';

/** Validates a correction request before it is sent; the server checks the window again. */
export function correctionBody(
  shift: Shift,
  input: { kind: CorrectionKind; date: string; time: string; reason: string },
): { body: Schemas['CorrectionIn'] } | { error: string } {
  if (input.reason.trim().length < 3) return { error: 'Add a short reason.' };
  const at = instantFromLocal(input.date, input.time, shift.time_zone);
  if (!at) return { error: 'Use a real date (YYYY-MM-DD) and time (HH:MM).' };
  const ms = new Date(at).getTime();
  const lo = new Date(shift.starts_at).getTime() - CORRECTION_WINDOW_MS;
  const hi = new Date(shift.ends_at).getTime() + CORRECTION_WINDOW_MS;
  if (ms < lo || ms > hi) return { error: 'That time is too far from the shift.' };
  return {
    body: { claim_kind: input.kind, claimed_at: at, reason: input.reason.trim() },
  };
}
