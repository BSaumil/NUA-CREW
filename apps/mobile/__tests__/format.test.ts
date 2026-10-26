import {
  distanceLabel,
  isStale,
  payLabel,
  payRange,
  postedAgo,
  profileStrength,
  superText,
} from '../src/features/format';

const pay = { pay_min: '28.00', pay_max: '32.00', pay_period: 'hour', pay_currency: 'AUD' };

describe('pay display', () => {
  it('formats ranges and singles', () => {
    expect(payRange(pay)).toBe('$28–$32 / hour');
    expect(payRange({ ...pay, pay_min: '28.50', pay_max: '28.50' })).toBe('$28.50 / hour');
    expect(payRange({ ...pay, pay_min: '85000.00', pay_max: '95000.00', pay_period: 'year' })).toBe(
      '$85,000–$95,000 / year',
    );
  });
  it('returns null when nothing was disclosed', () => {
    expect(
      payRange({ pay_min: null, pay_max: null, pay_period: null, pay_currency: 'AUD' }),
    ).toBeNull();
  });
  it('keeps disclosed, estimated and unpublished pay distinct', () => {
    expect(payLabel('disclosed')).toBe('Disclosed');
    expect(payLabel('estimated')).toBe('Estimated');
    expect(payLabel('not_disclosed')).toBeNull();
    expect(superText(null)).toBe('super not stated');
    expect(superText(true)).toBe('incl. super');
    expect(superText(false)).toBe('plus super');
  });
});

describe('freshness and distance', () => {
  const now = Date.parse('2026-10-26T00:00:00Z');
  it('flags listings not re-confirmed for two weeks', () => {
    expect(isStale('2026-10-20T00:00:00Z', now)).toBe(false);
    expect(isStale('2026-10-01T00:00:00Z', now)).toBe(true);
    expect(isStale(null, now)).toBe(false);
  });
  it('words relative dates', () => {
    expect(postedAgo('2026-10-26T00:00:00Z', now)).toBe('Today');
    expect(postedAgo('2026-10-25T00:00:00Z', now)).toBe('1 day ago');
    expect(postedAgo('2026-10-16T00:00:00Z', now)).toBe('10 days ago');
    expect(postedAgo(null, now)).toBeNull();
  });
  it('words distances', () => {
    expect(distanceLabel(0.4)).toBe('< 1 km away');
    expect(distanceLabel(3.26)).toBe('3.3 km away');
    expect(distanceLabel(12.4)).toBe('12 km away');
    expect(distanceLabel(null)).toBeNull();
  });
});

describe('profile strength', () => {
  it('is plain completeness, with one concrete next step', () => {
    expect(profileStrength({}, 0)).toEqual({ percent: 0, next: 'Add a headline' });
    const full = {
      headline: 'h',
      summary: 's',
      suburb: 'x',
      skills: ['a', 'b', 'c'],
      preferred_employment_types: ['casual'],
      min_hourly_pay: '27',
    };
    expect(profileStrength(full, 1)).toEqual({ percent: 100, next: null });
    expect(profileStrength(full, 0).next).toBe('Add a resume');
  });
});
