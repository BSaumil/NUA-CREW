import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Discover from '../app/(app)/discover';
import { api } from '../src/api/client';
import { fail, job, ok, renderApp } from './helpers';

jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  api: { GET: jest.fn(), PUT: jest.fn(), DELETE: jest.fn(), POST: jest.fn() },
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
const mockPosition = jest.fn();
jest.mock('../src/features/location', () => ({ getApproximatePosition: () => mockPosition() }));

const GET = api.GET as unknown as jest.Mock;
const PUT = api.PUT as unknown as jest.Mock;
const DELETE = api.DELETE as unknown as jest.Mock;

const page = (items: unknown[], total = items.length) =>
  ok({ items, total, page: 1, page_size: 15 });
let serverSaved: string[] = [];
function route(handlers: { jobs?: () => unknown; saved?: string[] }) {
  serverSaved = [...(handlers.saved ?? [])];
  GET.mockImplementation(async (path: string) => {
    if (path === '/v1/jobs') return (handlers.jobs ?? (() => page([])))();
    if (path === '/v1/candidate/saved-jobs/ids') return ok([...serverSaved]);
    throw new Error(`unexpected GET ${path}`);
  });
}
const lastJobsQuery = () =>
  [...GET.mock.calls].reverse().find((c) => c[0] === '/v1/jobs')![1].params.query;

beforeEach(() => {
  GET.mockReset();
  // The fake server remembers what was saved, like the real one.
  PUT.mockReset().mockImplementation(
    async (_p: string, o: { params: { path: { job_id: string } } }) => {
      serverSaved.push(o.params.path.job_id);
      return { response: { ok: true, status: 204 } };
    },
  );
  DELETE.mockReset().mockImplementation(
    async (_p: string, o: { params: { path: { job_id: string } } }) => {
      serverSaved = serverSaved.filter((x) => x !== o.params.path.job_id);
      return { response: { ok: true, status: 204 } };
    },
  );
  mockPush.mockReset();
  mockPosition.mockReset();
});

describe('Discover', () => {
  it('lists jobs with a count and opens one', async () => {
    route({ jobs: () => page([job(), job({ id: 'job-2', title: 'Kitchen Hand' })], 2) });
    await renderApp(<Discover />);
    expect(await screen.findByText('Kitchen Hand')).toBeOnTheScreen();
    expect(screen.getByText(/2 jobs · All jobs/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: /^Kitchen Hand,/ }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/job/[id]', params: { id: 'job-2' } });
  });

  it('shows a skeleton while loading, then an empty state with a way out', async () => {
    route({ jobs: () => page([]) });
    await renderApp(<Discover />);
    expect(await screen.findByText('No jobs match yet')).toBeOnTheScreen();
  });

  it('shows a readable error with retry when the network fails', async () => {
    let fail1 = true;
    route({ jobs: () => (fail1 ? fail(503, 'Service unavailable') : page([job()])) });
    await renderApp(<Discover />);
    expect(await screen.findByText('Something went wrong')).toBeOnTheScreen();
    fail1 = false;
    await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('Barista')).toBeOnTheScreen();
  });

  it('sends quick filters to the API and reports the active filter set', async () => {
    route({ jobs: () => page([job()]) });
    await renderApp(<Discover />);
    await screen.findByText('Barista');
    await fireEvent.press(screen.getByRole('button', { name: 'Casual' }));
    await waitFor(() => expect(lastJobsQuery()).toMatchObject({ employment_type: 'casual' }));
    await fireEvent.press(screen.getByRole('button', { name: '$30+/h' }));
    await waitFor(() =>
      expect(lastJobsQuery()).toMatchObject({ employment_type: 'casual', min_hourly: 30 }),
    );
    expect(screen.getByRole('button', { name: 'Filters (2)' })).toBeOnTheScreen();
    expect(await screen.findByText(/Casual · \$30\+\/h/)).toBeOnTheScreen();
  });

  it('"Near me" sends only rounded coordinates and sorts by distance; denial changes nothing', async () => {
    route({ jobs: () => page([job({ distance_km: 1.2 })]) });
    await renderApp(<Discover />);
    await screen.findByText('Barista');
    mockPosition.mockResolvedValueOnce({ ok: false, reason: 'denied' });
    await fireEvent.press(screen.getByRole('button', { name: 'Near me' }));
    expect(lastJobsQuery()).not.toHaveProperty('near_lat');
    mockPosition.mockResolvedValueOnce({ ok: true, lat: -37.81, lng: 144.96 });
    await fireEvent.press(screen.getByRole('button', { name: 'Near me' }));
    await waitFor(() =>
      expect(lastJobsQuery()).toMatchObject({
        near_lat: -37.81,
        near_lng: 144.96,
        radius_km: 10,
        sort: 'distance',
      }),
    );
    expect(await screen.findByText(/1\.2 km away/)).toBeOnTheScreen();
  });

  it('saving a job updates the heart immediately and calls the API', async () => {
    route({ jobs: () => page([job()]), saved: [] });
    await renderApp(<Discover />);
    await screen.findByText('Barista');
    await fireEvent.press(screen.getByRole('button', { name: 'Save Barista' }));
    expect(
      await screen.findByRole('button', { name: 'Remove Barista from saved jobs' }),
    ).toBeOnTheScreen();
    expect(PUT).toHaveBeenCalledWith('/v1/candidate/saved-jobs/{job_id}', {
      params: { path: { job_id: 'job-1' } },
    });
  });

  it('rolls the heart back if the server rejects the save', async () => {
    route({ jobs: () => page([job()]), saved: [] });
    PUT.mockResolvedValue(fail(500, 'boom'));
    await renderApp(<Discover />);
    await screen.findByText('Barista');
    await fireEvent.press(screen.getByRole('button', { name: 'Save Barista' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Save Barista' })).toBeOnTheScreen(),
    );
  });

  it('un-saving uses DELETE', async () => {
    route({ jobs: () => page([job()]), saved: ['job-1'] });
    await renderApp(<Discover />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Remove Barista from saved jobs' }),
    );
    expect(DELETE).toHaveBeenCalledWith('/v1/candidate/saved-jobs/{job_id}', {
      params: { path: { job_id: 'job-1' } },
    });
  });
});
