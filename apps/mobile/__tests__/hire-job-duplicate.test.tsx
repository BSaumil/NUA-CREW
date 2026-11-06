import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import ManageJob from '../app/hire-job/[id]';
import * as hire from '../src/api/hire';
import { job, renderApp } from './helpers';

jest.mock('@expo/vector-icons/Ionicons', () => () => null);
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: mockReplace }),
  useLocalSearchParams: () => ({ id: 'job-1' }),
}));
let mockRole = 'owner';
jest.mock('../src/state/HireWorkspace', () => ({
  useHireWorkspace: () => ({ employerId: 'e1', role: mockRole, pending: false, error: null }),
}));
jest.mock('../src/api/hire', () => ({
  canRecruit: (role: string) => role === 'owner' || role === 'recruiter',
  useHireJob: jest.fn(),
  useHireBusiness: jest.fn(),
  useHireApplicants: jest.fn(),
  useHireJobAction: jest.fn(),
  useHireDuplicate: jest.fn(),
}));
const query = (data: unknown) => ({ data, isPending: false, isError: false, refetch: jest.fn() });
const mockDuplicate = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  mockRole = 'owner';
  (hire.useHireBusiness as jest.Mock).mockReturnValue(query({ verification_status: 'verified' }));
  (hire.useHireApplicants as jest.Mock).mockReturnValue(query([]));
  (hire.useHireJobAction as jest.Mock).mockReturnValue({ mutateAsync: jest.fn() });
  (hire.useHireDuplicate as jest.Mock).mockReturnValue({
    mutateAsync: mockDuplicate,
    isPending: false,
  });
});

it('lets a recruiter copy even a closed job, then opens the new draft', async () => {
  (hire.useHireJob as jest.Mock).mockReturnValue(query(job({ status: 'closed' })));
  mockDuplicate.mockResolvedValue({ id: 'copy-1' });
  await renderApp(<ManageJob />);
  // A closed job cannot be edited or published, but it can be copied.
  expect(screen.queryByRole('button', { name: 'Publish job' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Duplicate as new draft' }));
  await waitFor(() =>
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/hire-job/[id]',
      params: { id: 'copy-1' },
    }),
  );
});

it('shows the reason when the copy is refused and stays on the job', async () => {
  (hire.useHireJob as jest.Mock).mockReturnValue(query(job({ status: 'published' })));
  mockDuplicate.mockRejectedValue(new Error('Too many requests'));
  await renderApp(<ManageJob />);
  await fireEvent.press(screen.getByRole('button', { name: 'Duplicate as new draft' }));
  await waitFor(() => expect(screen.getByRole('alert')).toBeOnTheScreen());
  expect(mockReplace).not.toHaveBeenCalled();
});

it('hides the control from viewers', async () => {
  mockRole = 'viewer';
  (hire.useHireJob as jest.Mock).mockReturnValue(query(job({ status: 'published' })));
  await renderApp(<ManageJob />);
  expect(screen.queryByRole('button', { name: 'Duplicate as new draft' })).toBeNull();
});
