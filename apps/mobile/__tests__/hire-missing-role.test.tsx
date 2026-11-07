import { fireEvent, screen } from '@testing-library/react-native';
import Home from '../app/hire';
import ManageJob from '../app/hire-job/[id]';
import * as hire from '../src/api/hire';
import { job, renderApp } from './helpers';

jest.mock('@expo/vector-icons/Ionicons', () => () => null);
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn() }),
  useLocalSearchParams: () => ({ id: 'job-1' }),
}));
let mockRole = 'owner';
jest.mock('../src/state/HireWorkspace', () => ({
  useHireWorkspace: () => ({ employerId: 'e1', role: mockRole, pending: false, error: null }),
}));
jest.mock('../src/api/hire', () => ({
  canRecruit: (role: string) => role === 'owner' || role === 'recruiter',
  useHireBusiness: jest.fn(),
  useHireJobs: jest.fn(),
  useHireLocations: jest.fn(),
  useHireMissingRole: jest.fn(),
  useHireJob: jest.fn(),
  useHireApplicants: jest.fn(),
  useHireJobAction: jest.fn(),
  useHireDuplicate: jest.fn(),
}));
const query = (data: unknown) => ({ data, isPending: false, isError: false, refetch: jest.fn() });
const gap = (over = {}) => ({ id: 'j9', title: 'Waiter', status: 'draft', ...over });

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = 'owner';
  (hire.useHireBusiness as jest.Mock).mockReturnValue(query({ verification_status: 'verified' }));
  (hire.useHireJobs as jest.Mock).mockReturnValue(query([job()]));
  (hire.useHireLocations as jest.Mock).mockReturnValue(query([{ id: 'v1', name: 'Main' }]));
  (hire.useHireApplicants as jest.Mock).mockReturnValue(query([]));
  (hire.useHireJobAction as jest.Mock).mockReturnValue({ mutateAsync: jest.fn() });
  (hire.useHireDuplicate as jest.Mock).mockReturnValue({
    mutateAsync: jest.fn(),
    isPending: false,
  });
});

describe('jobs without a role', () => {
  it('lists them on the hiring home and opens the editor for the one chosen', async () => {
    (hire.useHireMissingRole as jest.Mock).mockReturnValue(
      query({ required: false, jobs: [gap(), gap({ id: 'j10', title: 'Barista' })] }),
    );
    await renderApp(<Home />);
    expect(screen.getByText('2 jobs have no role or pay check')).toBeOnTheScreen();
    expect(screen.getByText(/check your pay against the award minimum/)).toBeOnTheScreen();
    await fireEvent.press(
      screen.getByRole('button', { name: 'Add a role and pay check to Waiter' }),
    );
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/hire-post', params: { id: 'j9' } });
  });

  it('says publishing is blocked when the server requires a role', async () => {
    (hire.useHireMissingRole as jest.Mock).mockReturnValue(
      query({ required: true, jobs: [gap()] }),
    );
    await renderApp(<Home />);
    expect(screen.getByText('1 job has no role or pay check')).toBeOnTheScreen();
    expect(screen.getByText(/cannot be published until a role and pay check/)).toBeOnTheScreen();
  });

  it('shows nothing when every job has a role, and no controls to a viewer', async () => {
    (hire.useHireMissingRole as jest.Mock).mockReturnValue(query({ required: false, jobs: [] }));
    await renderApp(<Home />);
    expect(screen.queryByText(/no role or pay check/)).toBeNull();

    mockRole = 'viewer';
    (hire.useHireMissingRole as jest.Mock).mockReturnValue(
      query({ required: false, jobs: [gap()] }),
    );
    await renderApp(<Home />);
    expect(screen.getByText('1 job has no role or pay check')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: /Add a role and pay check to/ })).toBeNull();
  });

  it('offers the editor from a job that has no role, but not from one that has', async () => {
    (hire.useHireJob as jest.Mock).mockReturnValue(query(job({ status: 'draft', role: null })));
    await renderApp(<ManageJob />);
    await fireEvent.press(screen.getByRole('button', { name: 'Add role and pay check' }));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/hire-post', params: { id: 'job-1' } });
  });

  it('does not offer it when the job already has a role', async () => {
    (hire.useHireJob as jest.Mock).mockReturnValue(
      query(job({ status: 'draft', role: { code: 'HC-0060', title: 'Waiter' } })),
    );
    await renderApp(<ManageJob />);
    expect(screen.queryByRole('button', { name: 'Add role and pay check' })).toBeNull();
  });
});
