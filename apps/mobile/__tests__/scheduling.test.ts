import { localParts } from '../src/features/scheduling';

it('uses the venue zone rather than the phone zone for shift hours', () => {
  expect(localParts('2027-01-01T13:30:00Z', 'Australia/Melbourne')).toEqual({
    date: '2027-01-02',
    time: '00:30',
  });
  expect(localParts('2027-01-01T13:30:00Z', 'Australia/Perth')).toEqual({
    date: '2027-01-01',
    time: '21:30',
  });
});
it('keeps the two DST-fold instants explicit when displaying actual work', () => {
  expect(localParts('2027-04-03T15:30:00Z', 'Australia/Melbourne').time).toBe('02:30');
  expect(localParts('2027-04-03T16:30:00Z', 'Australia/Melbourne').time).toBe('02:30');
});
