import { act, renderHook, waitFor } from '@testing-library/react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { api } from '../src/api/client';
import { useHireJobs, useHireSearch } from '../src/api/hire';
import { HireWorkspaceProvider, useHireWorkspace } from '../src/state/HireWorkspace';

jest.mock('../src/state/AuthProvider', () => ({
  useAuth: () => ({ status: 'signedIn', role: 'employer' }),
}));
jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  api: { GET: jest.fn(), POST: jest.fn() },
}));
const GET = api.GET as jest.Mock;
const POST = api.POST as jest.Mock;
function wrapper() {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: 0 },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>
      <HireWorkspaceProvider>{children}</HireWorkspaceProvider>
    </QueryClientProvider>
  );
}
const ok = (data: unknown) => ({ data, response: { ok: true, status: 200 } });
beforeEach(() => {
  GET.mockReset();
  POST.mockReset();
  GET.mockImplementation(async (path, opts) =>
    path === '/v1/auth/me'
      ? ok({
          memberships: [
            { employer_id: 'one', role: 'owner' },
            { employer_id: 'two', role: 'viewer' },
          ],
        })
      : ok([
          { id: opts.params.path.employer_id, title: `Jobs for ${opts.params.path.employer_id}` },
        ]),
  );
});

it('switches query scope and permissions without reusing another business data', async () => {
  const { result } = await renderHook(
    () => ({ workspace: useHireWorkspace(), jobs: useHireJobs() }),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(result.current.jobs.data?.[0]?.title).toBe('Jobs for one'));
  await act(async () => result.current.workspace.select('two'));
  await waitFor(() => expect(result.current.jobs.data?.[0]?.title).toBe('Jobs for two'));
  expect(result.current.workspace.role).toBe('viewer');
  await act(async () => result.current.workspace.select('not-a-membership'));
  expect(result.current.workspace.employerId).toBe('two');
  expect(
    GET.mock.calls
      .filter(([path]) => path.includes('/jobs'))
      .map(([, opts]) => opts.params.path.employer_id),
  ).toEqual(['one', 'two']);
});

it('does not show a late search result in the new workspace', async () => {
  let release!: (value: unknown) => void;
  POST.mockReturnValue(
    new Promise((resolve) => {
      release = resolve;
    }),
  );
  const { result } = await renderHook(
    () => ({ workspace: useHireWorkspace(), search: useHireSearch() }),
    { wrapper: wrapper() },
  );
  await waitFor(() => expect(result.current.workspace.employerId).toBe('one'));
  let pending!: Promise<unknown>;
  await act(async () => {
    pending = result.current.search.mutateAsync({
      kind: 'permanent',
      skills: [],
      availability: 'any',
      limit: 25,
      window_time_zone: 'Australia/Melbourne',
    });
  });
  await act(async () => result.current.workspace.select('two'));
  await act(async () => {
    release(ok({ items: [{ ref: 'old-business-reference' }] }));
    await pending;
  });
  expect(result.current.workspace.employerId).toBe('two');
  expect(result.current.search.data).toBeUndefined();
});
