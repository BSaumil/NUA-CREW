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
