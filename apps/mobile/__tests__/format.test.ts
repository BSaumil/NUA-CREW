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
    expect(payRange(pay)).toBe('$28â€“$32 / hour');
    expect(payRange({ ...pay, pay_min: '28.50', pay_max: '28.50' })).toBe('$28.50 / hour');
    expect(payRange({ ...pay, pay_min: '85000.00', pay_max: '95000.00', pay_period: 'year' })).toBe(
      '$85,000â€“$95,000 / year',
    );
  });
  it('never labels New Zealand wages as Australian dollars', () => {
    expect(payRange({ ...pay, pay_currency: 'NZD' })).toBe('NZ$28â€“NZ$32 / hour');
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
    expect(is¶»§q«^