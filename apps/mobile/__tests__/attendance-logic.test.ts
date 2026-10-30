import {
  attendanceLine,
  canCheckIn,
  canCheckOut,
  canMarkNoShow,
  checkInState,
  correctionBody,
  instantFromLocal,
} from '../src/features/attendance';

const shift = {
  starts_at: '2026-11-10T22:00:00Z', // 9:00 am Melbourne (UTC+11)
  ends_at: '2026-11-11T06:00:00Z', // 5:00 pm
  time_zone: 'Australia/Melbourne',
};
const at = (iso: string) => new Date(iso).getTime();
const att = (over: object = {}) =>
  ({
    status: 'not_started',
    check_in_at: null,
    check_out_at: null,
    venue_time_zone: shift.time_zone,
    pending_corrections: 0,
    events: [],
    ...over,
  }) as never;

describe('check in window', () => {
  it('opens one hour before the shift and closes when it ends', () => {
    expect(checkInState(shift, att(), at('2026-11-10T20:59:00Z'))).toBe('too_early');
    expect(checkInState(shift, att(), at('2026-11-10T21:00:00Z'))).toBe('open');
    expect(checkInState(shift, att(), at('2026-11-11T06:00:00Z'))).toBe('open');
    expect(checkInState(shift, att(), at('2026-11-11T06:01:00Z'))).toBe('closed');
  });

  it('never offers check in twice or after a no-show mark', () => {
    const mid = at('2026-11-11T00:00:00Z');
    expect(canCheckIn(shift, att(), mid)).toBe(true);
    expect(canCheckIn(shift, att({ check_in_at: '2026-11-10T22:05:00Z' }), mid)).toBe(false);
    expect(canCheckIn(shift, att({ status: 'no_show' }), mid)).toBe(false);
  });
});

describe('check out and no-show', () => {
  const inAt = { check_in_at: '2026-11-10T22:05:00Z', status: 'checked_in' };
  it('needs a check in and stays open 12 hours after the shift', () => {
    const now = at('2026-11-11T00:00:00Z');
    expect(canCheckOut(shift, att(), now)).toBe(false);
    expect(canCheckOut(shift, att(inAt), now)).toBe(true);
    expect(canCheckOut(shift, att(inAt), at('2026-11-11T18:00:00Z'))).toBe(true);
    expect(canCheckOut(shift, att(inAt), at('2026-11-11T18:01:00Z'))).toBe(false);
    expect(canCheckOut(shift, att({ ...inAt, check_out_at: '2026-11-11T06:00:00Z' }), now)).toBe(
      false,
    );
  });

  it('allows a no-show mark only after the grace period and only without a check in', () => {
    expect(canMarkNoShow(shift, att(), at('2026-11-10T22:29:00Z'))).toBe(false);
    expect(canMarkNoShow(shift, att(), at('2026-11-10T22:30:00Z'))).toBe(true);
    expect(canMarkNoShow(shift, att(inAt), at('2026-11-11T01:00:00Z'))).toBe(false);
    expect(canMarkNoShow(shift, att({ status: 'no_show' }), at('2026-11-11T01:00:00Z'))).toBe(
      false,
    );
  });
});

describe('attendanceLine', () => {
  it('speaks in the venue time zone and is honest about a no-show mark', () => {
    expect(attendanceLine(att(), shift.time_zone)).toBe('Not checked in yet.');
    const line = attendanceLine(
      att({ status: 'checked_in', check_in_at: '2026-11-10T22:05:00Z' }),
      shift.time_zone,
    );
    expect(line).toMatch(/Checked in 9:05\s?am/i);
    expect(attendanceLine(att({ status: 'no_show' }), shift.time_zone)).toMatch(/no-show/);
  });
});

describe('instantFromLocal', () => {
  it('turns a venue wall-clock time into the right instant', () => {
    expect(instantFromLocal('2026-11-11', '09:00', 'Australia/Melbourne')).toBe(
      '2026-11-10T22:00:00.000Z',
    );
    expect(instantFromLocal('2026-06-11', '09:00', 'Australia/Perth')).toBe(
      '2026-06-11T01:00:00.000Z',
    );
  });

  it('refuses malformed input and a time the clock skipped', () => {
    expect(instantFromLocal('2026-11-11', '9:00', 'Australia/Melbourne')).toBeNull();
    expect(instantFromLocal('11/11/2026', '09:00', 'Australia/Melbourne')).toBeNull();
    expect(instantFromLocal('2026-11-11', '24:00', 'Australia/Melbourne')).toBeNull();
    // clocks jump from 2:00 to 3:00 on 4 October 2026 in Sydney
    expect(instantFromLocal('2026-10-04', '02:30', 'Australia/Sydney')).toBeNull();
    expect(instantFromLocal('2026-10-04', '03:30', 'Australia/Sydney')).toBe(
      '2026-10-03T16:30:00.000Z',
    );
  });
});

describe('correctionBody', () => {
  const base = {
    kind: 'check_in' as const,
    date: '2026-11-11',
    time: '09:10',
    reason: 'Phone died',
  };
  it('builds a request the server accepts', () => {
    expect(correctionBody(shift, base)).toEqual({
      body: {
        claim_kind: 'check_in',
        claimed_at: '2026-11-10T22:10:00.000Z',
        reason: 'Phone died',
      },
    });
  });

  it('asks for a reason, a real time and one near the shift', () => {
    expect(correctionBody(shift, { ...base, reason: ' ' })).toEqual({
      error: 'Add a short reason.',
    });
    expect(correctionBody(shift, { ...base, time: 'nine' })).toMatchObject({
      error: expect.stringMatching(/real date/),
    });
    expect(correctionBody(shift, { ...base, date: '2026-12-25' })).toEqual({
      error: 'That time is too far from the shift.',
    });
  });
});

it('refuses rolled calendar dates and repeated daylight-saving wall times', () => {
  expect(instantFromLocal('2026-02-30', '12:00', 'Australia/Melbourne')).toBeNull();
  expect(instantFromLocal('2026-04-05', '02:30', 'Australia/Melbourne')).toBeNull();
});
it('does not offer a no-show action while a correction is waiting', () => {
  expect(
    canMarkNoShow(
      shift,
      att({ pending_corrections: 1 }),
      new Date(shift.starts_at).getTime() + 60 * 60_000,
    ),
  ).toBe(false);
});
