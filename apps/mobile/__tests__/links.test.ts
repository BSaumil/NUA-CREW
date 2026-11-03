import { routeFor } from '../src/features/links';

describe('notification routing', () => {
  it('opens the application a status update is about', () => {
    expect(routeFor('application.status_changed', { application_id: 'abc' })).toEqual({
      pathname: '/application/[id]',
      params: { id: 'abc' },
    });
  });
  it('opens the first job of an alert, or Discover when there is none', () => {
    expect(routeFor('job.alert', { job_ids: ['j1', 'j2'] })).toEqual({
      pathname: '/job/[id]',
      params: { id: 'j1' },
    });
    expect(routeFor('job.alert', {})).toBe('/(app)/discover');
  });
  it('ignores malformed payloads and unknown kinds', () => {
    expect(routeFor('application.status_changed', { application_id: 42 })).toBe('/(app)/alerts');
    expect(routeFor('something.new', null)).toBe('/(app)/alerts');
    expect(routeFor(undefined, undefined)).toBe('/(app)/alerts');
  });
});

it('routes attendance and timesheet updates to the correct audience workspace', () => {
  expect(routeFor('attendance.correction_requested', { booking_id: 'b1' }, true)).toBe(
    '/hire-shifts',
  );
  expect(routeFor('timesheet.reviewed', { booking_id: 'b1' })).toBe('/my-shifts');
  expect(routeFor('shift.offered', { booking_id: 'b1' })).toBe('/my-shifts');
  expect(routeFor('message_received', { conversation_id: 'c1' }, true)).toEqual({
    pathname: '/hire-thread/[id]',
    params: { id: 'c1' },
  });
  expect(routeFor('unknown', { url: 'https://evil.invalid' }, true)).toBe('/hire-alerts');
});
