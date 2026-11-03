import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import Applications from '../app/(app)/applications';
import ApplicationDetail from '../app/application/[id]';
import Settings from '../app/settings';
import { api } from '../src/api/client';
import { fail, ok, renderApp } from './helpers';

jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  api: { GET: jest.fn(), PUT: jest.fn(), DELETE: jest.fn(), POST: jest.fn() },
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ id: 'app-1' }),
}));
const mockClearLocal = jest.fn();
jest.mock('../src/state/AuthProvider', () => ({
  useAuth: () => ({
    biometricAvailable: false,
    biometricEnabled: false,
    setBiometric: jest.fn(),
    signOut: jest.fn(),
    clearLocal: mockClearLocal,
  }),
}));
jest.mock('expo-application', () => ({
  nativeApplicationVersion: '0.1.0',
  nativeBuildVersion: '1',
}));
jest.mock('expo-sharing', () => ({ isAvailableAsync: async () => false, shareAsync: jest.fn() }));
jest.mock('expo-file-system', () => ({ File: class {}, Paths: { cache: '' } }));
jest.mock('../src/features/push', () => ({
  enablePush: jest.fn(async () => 'registered'),
  disablePush: jest.fn(),
}));

const GET = api.GET as unknown as jest.Mock;
const POST = api.POST as unknown as jest.Mock;
const DELETE = api.DELETE as unknown as jest.Mock;
const PUT = api.PUT as unknown as jest.Mock;

const app = (over = {}) => ({
  id: 'app-1',
  status: 'under_review',
  cover_note: 'Keen',
  created_at: '2026-10-01T00:00:00Z',
  updated_at: '2026-10-02T00:00:00Z',
  job: {
    id: 'job-1',
    title: 'Barista',
    employer_name: 'Fictional Cafe',
    suburb: 'Fitzroy',
    status: 'published',
  },
  events: [
    {
      id: 'e1',
      event_type: 'submitted',
      from_status: null,
      to_status: 'submitted',
      actor_role: 'candidate',
      note: null,
      created_at: '2026-10-01T00:00:00Z',
    },
    {
      id: 'e2',
      event_type: 'status_changed',
      from_status: 'submitted',
      to_status: 'under_review',
      actor_role: 'employer',
      note: null,
      created_at: '2026-10-02T00:00:00Z',
    },
  ],
  ...over,
});

beforeEach(() => {
  [GET, POST, DELETE, PUT, mockPush, mockClearLocal].forEach((m) => m.mockReset());
  jest.restoreAllMocks();
});

describe('Applications list', () => {
  it('separates active from closed and says who changes statuses', async () => {
    GET.mockResolvedValue(
      ok([
        app(),
        app({
          id: 'app-2',
          status: 'rejected',
          job: { id: 'j2', title: 'Chef', employer_name: 'Bistro', suburb: null, status: 'closed' },
        }),
      ]),
    );
    await renderApp(<Applications />);
    expect(await screen.findByText('Barista')).toBeOnTheScreen();
    expect(screen.queryByText('Chef')).toBeNull();
    expect(screen.getByText(/made by people at the employer/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Closed (1)' }));
    expect(screen.getByText('Chef')).toBeOnTheScreen();
    expect(screen.getByText('Not progressed')).toBeOnTheScreen();
  });

  it('invites the first application when there is none', async () => {
    GET.mockResolvedValue(ok([]));
    await renderApp(<Applications />);
    expect(await screen.findByText('No active applications')).toBeOnTheScreen();
  });
});

describe('Application detail', () => {
  it('shows recorded events and identifies people as the decision makers', async () => {
    GET.mockResolvedValue(ok(app()));
    await renderApp(<ApplicationDetail />);
    expect(await screen.findByText('You submitted this application')).toBeOnTheScreen();
    expect(screen.getByText('The employer updated your status')).toBeOnTheScreen();
    expect(screen.getByText(/Decisions are made by people at the employer/)).toBeOnTheScreen();
  });

  it('withdraws only after confirmation', async () => {
    GET.mockResolvedValue(ok(app()));
    POST.mockResolvedValue(ok(app({ status: 'withdrawn' })));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderApp(<ApplicationDetail />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Withdraw application' }));
    expect(POST).not.toHaveBeenCalled();
    const buttons = alert.mock.calls[0]![2] as { text: string; onPress?: () => void }[];
    await buttons.find((b) => b.text === 'Withdraw')!.onPress!();
    await waitFor(() =>
      expect(POST).toHaveBeenCalledWith('/v1/candidate/applications/{application_id}/withdraw', {
        params: { path: { application_id: 'app-1' } },
      }),
    );
  });

  it('offers no withdraw button once the application is closed', async () => {
    GET.mockResolvedValue(ok(app({ status: 'hired' })));
    await renderApp(<ApplicationDetail />);
    await screen.findByText('Barista');
    expect(screen.queryByRole('button', { name: 'Withdraw application' })).toBeNull();
  });
});

describe('Settings', () => {
  const profile = {
    id: 'p',
    full_name: 'A',
    discoverable: false,
    push_enabled: true,
    skills: [],
    preferred_employment_types: [],
  };
  beforeEach(() => GET.mockImplementation(async () => ok(profile)));

  it('talent discovery is off by default and changing it calls the API', async () => {
    PUT.mockResolvedValue(ok({ ...profile, discoverable: true }));
    await renderApp(<Settings />);
    const sw = await screen.findByLabelText('Let verified employers discover my profile');
    expect(sw).toHaveProp('value', false);
    await fireEvent(sw, 'valueChange', true);
    await waitFor(() =>
      expect(PUT).toHaveBeenCalledWith('/v1/candidate/consents/talent-discovery', {
        body: { granted: true },
      }),
    );
  });

  it('deleting the account needs the password, explains what is erased, and wipes local data on success', async () => {
    DELETE.mockResolvedValue({ response: { ok: true, status: 204 } });
    await renderApp(<Settings />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete my account' }));
    expect(
      await screen.findByText(/permanently erases your profile, resumes, applications/),
    ).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: 'Delete everything' })).toBeDisabled(); // no password yet
    await fireEvent.changeText(
      screen.getByLabelText('Confirm with your password'),
      'my-password-123',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Delete everything' }));
    await waitFor(() =>
      expect(DELETE).toHaveBeenCalledWith('/v1/account', { body: { password: 'my-password-123' } }),
    );
    await waitFor(() => expect(mockClearLocal).toHaveBeenCalled());
  });

  it('keeps the account and shows the reason when the password is wrong', async () => {
    DELETE.mockResolvedValue(fail(403, 'Your password is incorrect'));
    await renderApp(<Settings />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Delete my account' }));
    await fireEvent.changeText(await screen.findByLabelText('Confirm with your password'), 'nope');
    await fireEvent.press(screen.getByRole('button', { name: 'Delete everything' }));
    expect(await screen.findByText('Your password is incorrect')).toBeOnTheScreen();
    expect(mockClearLocal).not.toHaveBeenCalled();
  });

  it('password change validates length locally and surfaces server errors', async () => {
    POST.mockResolvedValue(fail(403, 'Your current password is incorrect'));
    await renderApp(<Settings />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Change password' }));
    await fireEvent.changeText(await screen.findByLabelText('Current password'), 'old-password-1');
    await fireEvent.changeText(screen.getByLabelText('New password'), 'short');
    await fireEvent.press(screen.getAllByRole('button', { name: 'Change password' }).at(-1)!);
    expect(await screen.findByText('Use at least 12 characters')).toBeOnTheScreen();
    expect(POST).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('New password'), 'a-brand-new-password');
    await fireEvent.press(screen.getAllByRole('button', { name: 'Change password' }).at(-1)!);
    expect(await screen.findByText('Your current password is incorrect')).toBeOnTheScreen();
  });
});
