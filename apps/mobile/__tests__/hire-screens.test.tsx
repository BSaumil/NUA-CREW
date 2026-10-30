import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Home from '../app/hire';
import Post from '../app/hire-post';
import Applicant from '../app/hire-applicant/[id]';
import { renderApp, job } from './helpers';
import * as hire from '../src/api/hire';

jest.mock('@expo/vector-icons/Ionicons', () => () => null);

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockRole = 'owner';
let mockPending = false;
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => ({}),
}));
jest.mock('../src/state/HireWorkspace', () => ({
  useHireWorkspace: () => ({
    employerId: 'e1',
    role: mockRole,
    pending: mockPending,
    error: null,
  }),
}));
jest.mock('../src/api/hire', () => ({
  canRecruit: (role: string) => role === 'owner' || role === 'recruiter',
  useHireBusiness: jest.fn(),
  useHireJobs: jest.fn(),
  useHireLocations: jest.fn(),
  useHireCreateJob: jest.fn(),
  useHireEditJob: jest.fn(),
  useHireApplicant: jest.fn(),
  useHireDecision: jest.fn(),
}));
const query = (data: unknown) => ({ data, isPending: false, isError: false, refetch: jest.fn() });
const mockSave = jest.fn();
const mockDecide = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  mockRole = 'owner';
  mockPending = false;
  (hire.useHireBusiness as jest.Mock).mockReturnValue(
    query({ name: 'Fictional Cafe', verification_status: 'verified' }),
  );
  (hire.useHireJobs as jest.Mock).mockReturnValue(
    query([job(), job({ id: 'draft-1', status: 'draft', title: 'Chef' })]),
  );
  (hire.useHireLocations as jest.Mock).mockReturnValue(
    query([{ id: 'venue-1', name: 'Main', suburb: 'Alphington' }]),
  );
  (hire.useHireCreateJob as jest.Mock).mockReturnValue({ mutateAsync: mockSave, isPending: false });
  (hire.useHireEditJob as jest.Mock).mockReturnValue({ mutateAsync: mockSave, isPending: false });
  (hire.useHireDecision as jest.Mock).mockReturnValue({
    mutateAsync: mockDecide,
    isPending: false,
  });
  (hire.useHireApplicant as jest.Mock).mockReturnValue(
    query({
      full_name: 'Ana Brown',
      job_title: 'Barista',
      status: 'submitted',
      skills: ['Coffee'],
      events: [],
    }),
  );
});

it('shows real job counts, filters drafts and opens the selected job', async () => {
  await renderApp(<Home />);
  expect(screen.getByText('1 live job')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Drafts' }));
  expect(screen.getByText('Chef')).toBeOnTheScreen();
  expect(screen.queryByText('Barista')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Manage Chef' }));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/hire-job/[id]', params: { id: 'draft-1' } });
});
it('keeps posting controls out of a viewer workspace', async () => {
  mockRole = 'viewer';
  await renderApp(<Home />);
  expect(screen.queryByRole('button', { name: /Post a job/ })).toBeNull();
});
it('explains business verification without stopping drafts', async () => {
  (hire.useHireBusiness as jest.Mock).mockReturnValue(
    query({ name: 'Cafe', verification_status: 'unverified' }),
  );
  await renderApp(<Home />);
  expect(screen.getByText('Your business needs verification')).toBeOnTheScreen();
  expect(screen.getByRole('button', { name: /Post a job/ })).toBeOnTheScreen();
});
it('walks role → pay → review and saves a draft without publishing', async () => {
  mockSave.mockResolvedValue({ id: 'draft-new' });
  await renderApp(<Post />);
  await fireEvent.press(screen.getByRole('button', { name: 'Continue to pay' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/job title/);
  await fireEvent.changeText(screen.getByLabelText('Job title'), 'Barista');
  await fireEvent.press(screen.getByRole('button', { name: 'Main · Alphington' }));
  await fireEvent.changeText(
    screen.getByLabelText('About the role'),
    'Make coffee and welcome guests.',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Continue to pay' }));
  await fireEvent.changeText(screen.getByLabelText('Minimum pay (AUD)'), '30');
  await fireEvent.changeText(screen.getByLabelText('Maximum pay (AUD)'), '35');
  await fireEvent.press(screen.getByRole('button', { name: 'Plus super' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Review advertisement' }));
  expect(mockSave).not.toHaveBeenCalled();
  expect(screen.getByText('AUD 30–35 per hour · plus super')).toBeOnTheScreen();
  await fireEvent.press(screen.getByRole('button', { name: 'Save draft' }));
  await waitFor(() =>
    expect(mockSave).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Barista',
        location_id: 'venue-1',
        pay_min: '30',
        pay_max: '35',
        super_included: false,
      }),
    ),
  );
  expect(mockReplace).toHaveBeenCalledWith({
    pathname: '/hire-job/[id]',
    params: { id: 'draft-new' },
  });
});
it('does not let a viewer create a draft', async () => {
  mockRole = 'viewer';
  await renderApp(<Post />);
  expect(screen.getByText('View-only access')).toBeOnTheScreen();
  expect(screen.queryByRole('button', { name: 'Save draft' })).toBeNull();
});
it('requires a job-related reason before rejecting an applicant', async () => {
  await renderApp(<Applicant />);
  await fireEvent.press(screen.getByRole('button', { name: 'Do not progress' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/reason/);
  expect(mockDecide).not.toHaveBeenCalled();
});
