import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api, messageOf } from '../src/api/client';
import { session } from '../src/api/session';
import { AuthProvider, useAuth } from '../src/state/AuthProvider';

jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  api: { GET: jest.fn(), PUT: jest.fn(), DELETE: jest.fn(), POST: jest.fn() },
}));
jest.mock('expo-local-authentication', () => ({
  hasHardwareAsync: async () => false,
  isEnrolledAsync: async () => false,
  authenticateAsync: jest.fn(),
}));
jest.mock('expo-device', () => ({ modelName: 'Test Phone' }));
jest.mock('../src/features/push', () => ({ disablePush: jest.fn(async () => undefined) }));

const POST = api.POST as unknown as jest.Mock;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>
    <AuthProvider>{children}</AuthProvider>
  </QueryClientProvider>
);
const tokens = (role: string) => ({
  access_token: 'a',
  refresh_token: 'r',
  expires_in: 1800,
  role,
  user_id: 'u',
});
const ok = (data: unknown) => ({ data, response: { ok: true, status: 200 } });

beforeEach(async () => {
  POST.mockReset();
  await session.clear();
});

it('starts a session for a candidate and asks the server for a mobile refresh token', async () => {
  POST.mockResolvedValue(ok(tokens('candidate')));
  const { result } = await renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe('signedOut'));
  await act(async () => result.current.signIn('a@b.co', 'pw-long-enough-1'));
  expect(POST).toHaveBeenCalledWith('/v1/auth/login', {
    body: {
      email: 'a@b.co',
      password: 'pw-long-enough-1',
      client: 'mobile',
      device_label: 'Test Phone',
    },
  });
  await waitFor(() => expect(result.current.status).toBe('signedIn'));
});

it('refuses employer accounts, shows why, and revokes the token it was just issued', async () => {
  POST.mockImplementation(async (path: string) =>
    path === '/v1/auth/login' ? ok(tokens('employer')) : { response: { ok: true, status: 204 } },
  );
  const { result } = await renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe('signedOut'));
  let error: unknown;
  await act(async () => {
    await result.current.signIn('boss@b.co', 'pw-long-enough-1').catch((e) => (error = e));
  });
  expect(messageOf(error)).toMatch(/This app is for job seekers/);
  expect(POST).toHaveBeenCalledWith('/v1/auth/logout', { body: { refresh_token: 'r' } });
  expect(result.current.status).toBe('signedOut');
});
