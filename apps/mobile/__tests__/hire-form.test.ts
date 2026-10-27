import type { Schemas } from '@nua-crew/contracts';
import { validateJob, validateWorkWindow } from '../src/features/hire-form';

const draft = (over: Partial<Schemas['JobIn']> = {}): Schemas['JobIn'] => ({
  title: 'Barista',
  description: 'Make coffee and welcome guests.',
  location_id: 'venue-1',
  employment_type: 'part_time',
  engagement_basis: 'employee',
  duration_type: 'ongoing',
  hours_pattern: 'part_time',
  pay_min: '30',
  pay_max: '35',
  pay_period: 'hour',
  super_included: false,
  skills: [],
  ...over,
});

it('allows role details before pay is entered, but requires pay before review', () => {
  expect(validateJob(draft({ pay_min: null }), 0)).toBeNull();
  expect(validateJob(draft({ pay_min: null }), 1)).toMatch(/minimum and maximum/);
});
it.each(['NaN', '-1', '0', 'Infinity'])('rejects unusable pay %s', (amount) => {
  expect(validateJob(draft({ pay_min: amount }), 2)).toMatch(/positive/);
});
it('requires a genuine pay range and an explicit super choice', () => {
  expect(validateJob(draft({ pay_min: '40', pay_max: '30' }), 2)).toMatch(/Maximum/);
  expect(validateJob(draft({ super_included: null }), 2)).toMatch(/super/);
  expect(validateJob(draft({ pay_min: '30', pay_max: '30' }), 2)).toBeNull();
});
it('requires a title, work location and description', () => {
  expect(validateJob(draft({ title: ' ' }), 0)).toMatch(/title/);
  expect(validateJob(draft({ location_id: null }), 0)).toMatch(/location/);
  expect(validateJob(draft({ description: '' }), 0)).toMatch(/role involves/);
});

it('checks optional hours and real dates without inventing missing values', () => {
  expect(validateJob(draft({ min_weekly_hours: '40', max_weekly_hours: '30' }), 0)).toMatch(
    /Maximum weekly/,
  );
  expect(validateJob(draft({ max_weekly_hours: '169' }), 0)).toMatch(/0 and 168/);
  expect(validateJob(draft({ start_date: '2027-02-30' }), 0)).toMatch(/real date/);
  expect(validateJob(draft({ start_date: '2027-03-02', end_date: '2027-03-01' }), 0)).toMatch(
    /End date/,
  );
  expect(validateJob(draft({ start_date: null, min_weekly_hours: null }), 0)).toBeNull();
});
it('accepts overnight windows and catches partial or invalid local times', () => {
  expect(validateWorkWindow('', '', '')).toBeNull();
  expect(validateWorkWindow('2027-03-01', '22:00', '06:00')).toBeNull();
  expect(validateWorkWindow('2027-02-30', '09:00', '17:00')).toMatch(/real work date/);
  expect(validateWorkWindow('2027-03-01', '24:00', '06:00')).toMatch(/24-hour/);
  expect(validateWorkWindow('2027-03-01', '09:00', '')).toMatch(/both/);
  expect(validateWorkWindow('2027-03-01', '09:00', '09:00')).toMatch(/must differ/);
});
