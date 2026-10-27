import {
  describeWindow,
  modeOf,
  parseDate,
  parseTime,
  prefToForm,
  validatePref,
  windowError,
  windowsOverlap,
  emptyPref,
  sameRules,
} from '../src/features/availability';

describe('parseTime', () => {
  it.each([
    ['9', '09:00'],
    ['9:30', '09:30'],
    ['17:05', '17:05'],
    ['9am', '09:00'],
    ['12 am', '00:00'],
    ['12pm', '12:00'],
    ['5:15 PM', '17:15'],
    ['0:00', '00:00'],
    ['23:59', '23:59'],
  ])('reads %s as %s', (input, out) => expect(parseTime(input)).toBe(out));

  it.each(['', 'noon', '24:00', '9:60', '13pm', '0am', '9:5', '1:2:3'])('rejects %j', (v) =>
    expect(parseTime(v)).toBeNull(),
  );
});

describe('parseDate', () => {
  it('accepts ISO and day-first Australian dates', () => {
    expect(parseDate('2026-11-03')).toBe('2026-11-03');
    expect(parseDate('3/11/2026')).toBe('2026-11-03');
    expect(parseDate('03-11-2026')).toBe('2026-11-03');
  });
  it('rejects impossible dates and other shapes', () => {
    for (const v of ['31/2/2026', '2026-13-01', '1/1/26', 'tomorrow', '', '0/1/2026'])
      expect(parseDate(v)).toBeNull();
  });
});

const r = (weekday: number, a: string, b: string) => ({
  weekday,
  start_time: a,
  end_time: b,
});

describe('windowsOverlap (mirrors the server rule)', () => {
  it('allows several windows in a day and back-to-back windows', () => {
    expect(windowsOverlap([r(1, '09:00', '12:00'), r(1, '14:00', '18:00')])).toBe(false);
    expect(windowsOverlap([r(1, '09:00', '12:00'), r(1, '12:00', '13:00')])).toBe(false);
  });
  it('rejects overlaps, overnight spill into the next day and the Sunday to Monday wrap', () => {
    expect(windowsOverlap([r(1, '09:00', '12:00'), r(1, '11:00', '13:00')])).toBe(true);
    expect(windowsOverlap([r(5, '22:00', '06:00'), r(6, '05:00', '08:00')])).toBe(true);
    expect(windowsOverlap([r(6, '22:00', '06:00'), r(0, '05:00', '08:00')])).toBe(true);
    expect(windowsOverlap([r(5, '22:00', '06:00'), r(6, '06:00', '08:00')])).toBe(false);
  });
});

describe('windowError', () => {
  it('explains each problem next to its field and keeps the form error separate', () => {
    expect(windowError('', '5pm', [], 1).start).toMatch(/Enter a time/);
    expect(windowError('9am', 'x', [], 1).end).toMatch(/Enter a time/);
    expect(windowError('9am', '9:00', [], 1).end).toMatch(/different/);
    const clash = windowError('11am', '1pm', [r(1, '09:00', '12:00')], 1);
    expect(clash.form).toMatch(/overlaps/);
    expect(clash.value).toBeUndefined();
  });
  it('accepts an overnight window', () => {
    const ok = windowError('10pm', '6am', [], 5);
    expect(ok.value).toEqual(r(5, '22:00', '06:00'));
    expect(describeWindow('22:00:00', '06:00:00')).toBe('10:00 pm to 6:00 am (next day)');
  });
});

describe('work preference form', () => {
  const form = (over = {}) => ({ ...emptyPref(), enabled: true, ...over });

  it('turns a valid permanent form into the API body, keeping kinds apart', () => {
    const { body, errors } = validatePref(
      form({
        engagement: ['employee'],
        hours: ['full_time'],
        minPay: '40',
        notice: '28',
        availableFrom: '1/2/2027',
        maxTravel: '99', // belongs to temporary: must not leak into permanent
      }),
      'permanent',
    );
    expect(errors).toEqual({});
    expect(body).toMatchObject({
      enabled: true,
      min_hourly_pay: '40.00',
      notice_period_days: 28,
      available_from: '2027-02-01',
      max_travel_km: null,
    });
  });

  it('flags each invalid field and sends nothing', () => {
    const { body, errors } = validatePref(
      form({
        minWeekly: '30',
        maxWeekly: '10',
        minPay: 'abc',
        notice: '999',
        availableFrom: 'soon',
      }),
      'permanent',
    );
    expect(body).toBeUndefined();
    expect(Object.keys(errors).sort()).toEqual(['availableFrom', 'maxWeekly', 'minPay', 'notice']);
    expect(validatePref(form({ maxTravel: '2.5' }), 'temporary').errors.maxTravel).toBeTruthy();
  });

  it('round-trips a saved preference without losing fields', () => {
    const saved = {
      kind: 'permanent',
      enabled: false,
      discoverable: false,
      engagement_bases: ['employee'],
      hours_patterns: ['full_time'],
      min_weekly_hours: '30.00',
      max_weekly_hours: null,
      min_hourly_pay: '40.00',
      max_travel_km: null,
      notice_period_days: 28,
      available_from: '2027-02-01',
    };
    const f = prefToForm(saved);
    expect(f).toMatchObject({
      minWeekly: '30',
      minPay: '40.00',
      notice: '28',
      availableFrom: '1/2/2027',
    });
    expect(validatePref({ ...f, enabled: false }, 'permanent').body).toMatchObject({
      enabled: false,
      notice_period_days: 28,
    });
  });

  it('describes the chosen mode', () => {
    expect(modeOf(true, true)).toBe('both');
    expect(modeOf(true, false)).toBe('permanent');
    expect(modeOf(false, true)).toBe('temporary');
    expect(modeOf(false, false)).toBe('none');
  });
});

it('compares rule sets ignoring order and seconds', () => {
  expect(
    sameRules(
      [r(1, '09:00:00', '12:00:00'), r(0, '08:00', '09:00')],
      [r(0, '08:00', '09:00'), r(1, '09:00', '12:00')],
    ),
  ).toBe(true);
  expect(sameRules([r(1, '09:00', '12:00')], [])).toBe(false);
});
