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

it('opens an employer session with the correct role and clears it on sign-out', async () => {
  POST.mockResolvedValue(ok(tokens('employer')));
  const { result } = await renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe('signedOut'));
  await act(async () => result.current.signIn('owner@example.com', 'long-password-1'));
  expect(result.current.role).toBe('employer');
  expect(session.role).toBe('employer');
  session.fetchImpl = jest.fn().mockResolvedValue({ status: 204 });
  await act(async () => {
    await result.current.signOut();
  });
  expect(result.current.status).toBe('signedOut');
  expect(result.current.role).toBeNull();
  expect(session.role).toBeNull();
});

it('refuses operator accounts, shows why, and revokes the token it was just issued', async () => {
  POST.mockImplementation(async (path: string) =>
    path === '/v1/auth/login' ? ok(tokens('admin')) : { response: { ok: true, status: 204 } },
  );
  const { result } = await renderHook(() => useAuth(), { wrapper });
  await waitFor(() => expect(result.current.status).toBe('signedOut'));
  let error: unknown;
  await act(async () => {
    await result.current.signIn('boss@b.co', 'pw-long-enough-1').catch((e) => (error = e));
  });
  expect(messageOf(error)).toMatch(/Operator accounts use/);
  expect(POST).toHaveBeenCalledWith('/v1/auth/logout', { body: { refresh_token: 'r' } });
  expect(result.current.status).toBe('signedOut');
});

describe('cache hygiene and lock', () => {
  const clientWrapper = (qc: QueryClient) =>
    function W({ children }: { children: ReactNode }) {
      return (
        <QueryClientProvider client={qc}>
          <AuthProvider>{children}</AuthProvider>
        </QueryClientProvider>
      );
    };

  it('clears private query caches on every signed-out event, even a rejected refresh', async () => {
    const qc = new QueryClient();
    POST.mockResolvedValue(ok(tokens('candidate')));
    const { result } = await renderHook(() => useAuth(), { wrapper: clientWrapper(qc) });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    await act(async () => result.current.signIn('a@b.co', 'pw-long-enough-1'));
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    qc.setQueryData(['applications'], [{ id: 'private' }]);
    qc.setQueryData(['invitation', 'inv-1'], { terms: { business: 'Previous Account Cafe' } });
    qc.setQueryData(['messages', 'conv-1'], { pages: [{ items: [{ body: 'private words' }] }] });
    // Not the sign-out button: the server revoked us and the next refresh is rejected.
    session.fetchImpl = (async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    await act(async () => {
      await session.refreshNow();
    });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(qc.getQueryData(['applications'])).toBeUndefined();
    // a notification deep link opened after switching accounts must not show the previous account
    expect(qc.getQueryData(['invitation', 'inv-1'])).toBeUndefined();
    expect(qc.getQueryData(['messages', 'conv-1'])).toBeUndefined();
  });

  it('reports a failed Keychain/Keystore deletion but still signs the person out', async () => {
    const qc = new QueryClient();
    POST.mockResolvedValue(ok(tokens('candidate')));
    const { result } = await renderHook(() => useAuth(), { wrapper: clientWrapper(qc) });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    await act(async () => result.current.signIn('a@b.co', 'pw-long-enough-1'));
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('expo-secure-store').deleteItemAsync as jest.Mock).mockRejectedValueOnce(
      new Error('keystore'),
    );
    let out: { credentialsRemoved: boolean } | undefined;
    await act(async () => {
      out = await result.current.signOut();
    });
    expect(out).toEqual({ credentialsRemoved: false });
    expect(result.current.status).toBe('signedOut');
  });
});
