import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import JobDetail from '../app/job/[id]';
import { api } from '../src/api/client';
import { fail, job, ok, renderApp } from './helpers';

jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  api: { GET: jest.fn(), PUT: jest.fn(), DELETE: jest.fn(), POST: jest.fn() },
}));
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'job-1' }),
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  Stack: { Screen: () => null },
}));
const mockOpenBrowser = jest.fn();
jest.mock('expo-web-browser', () => ({ openBrowserAsync: (u: string) => mockOpenBrowser(u) }));

const GET = api.GET as unknown as jest.Mock;
const POST = api.POST as unknown as jest.Mock;

const match = {
  job_id: 'job-1',
  estimate: 62.5,
  label: 'Estimated match — not a prediction of being hired',
  gates: [],
  missing_skills: ['Latte art'],
  components: [
    {
      key: 'skills',
      weight: 25,
      evaluated: true,
      score: 0.5,
      evidence: '1 of 2 listed skills are on your profile.',
      basis: 'self_declared',
    },
  ],
};

function serve(
  over: { job?: unknown; apps?: unknown[]; resumes?: unknown[]; matchResult?: unknown } = {},
) {
  GET.mockImplementation(async (path: string) => {
    switch (path) {
      case '/v1/jobs/{job_id}':
        return over.job ? (over.job as object) : ok(job());
      case '/v1/jobs/{job_id}/match':
        return over.matchResult ?? ok(match);
      case '/v1/candidate/saved-jobs/ids':
        return ok([]);
      case '/v1/candidate/applications':
        return ok(over.apps ?? []);
      case '/v1/candidate/resumes':
        return ok(
          over.resumes ?? [
            {
              id: 'r1',
              title: 'Main resume',
              versions: [
                { id: 'v1', version: 2, content_text: 'x', created_at: new Date().toISOString() },
              ],
            },
          ],
        );
      default:
        throw new Error(`unexpected GET ${path}`);
    }
  });
}

beforeEach(() => {
  [GET, POST, mockPush, mockReplace, mockOpenBrowser].forEach((m) => m.mockReset());
  jest.restoreAllMocks();
});

describe('Job detail', () => {
  it('shows the role, honest trust and pay labels, and no stale warning for a fresh listing', async () => {
    serve();
    await renderApp(<JobDetail />);
    expect(await screen.findByRole('header', { name: 'Barista' })).toBeOnTheScreen();
    expect(screen.getByText(/Verified business · not an endorsement/)).toBeOnTheScreen();
    expect(screen.getByText('Disclosed')).toBeOnTheScreen();
    expect(screen.getByText('Make coffee')).toBeOnTheScreen();
    expect(screen.queryByText(/not been re-confirmed recently/)).toBeNull();
  });

  it('warns when nobody has re-confirmed the listing for weeks', async () => {
    serve({
      job: ok(job({ last_verified_at: new Date(Date.now() - 30 * 86_400_000).toISOString() })),
    });
    await renderApp(<JobDetail />);
    expect(await screen.findByText(/has not been re-confirmed recently/)).toBeOnTheScreen();
  });

  it('explains the match as an estimate with evidence on its own tab', async () => {
    serve();
    await renderApp(<JobDetail />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'My match' }));
    expect(await screen.findByText('63% estimate')).toBeOnTheScreen();
    expect(screen.getByText(/not a prediction of being hired/)).toBeOnTheScreen();
    expect(screen.getByText('1 of 2 listed skills are on your profile.')).toBeOnTheScreen();
  });

  it('says what "verified" means on the company tab', async () => {
    serve();
    await renderApp(<JobDetail />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Company' }));
    expect(screen.getByText(/it is not an endorsement/)).toBeOnTheScreen();
  });

  it('applies with the chosen resume and note, then opens the application', async () => {
    serve();
    POST.mockResolvedValue(ok({ id: 'app-9', status: 'submitted' }));
    await renderApp(<JobDetail />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Apply' }));
    await fireEvent.changeText(
      await screen.findByLabelText('Note to the employer (optional)'),
      'Happy to start next week',
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Submit application' }));
    await waitFor(() =>
      expect(POST).toHaveBeenCalledWith('/v1/jobs/{job_id}/applications', {
        params: {
          path: { job_id: 'job-1' },
          header: { 'idempotency-key': expect.stringMatching(/^[0-9a-f-]{36}$/) },
        },
        body: { resume_id: 'r1', cover_note: 'Happy to start next week' },
        headers: { 'Idempotency-Key': expect.any(String) },
      }),
    );
    await waitFor(() =>
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: '/application/[id]',
        params: { id: 'app-9' },
      }),
    );
  });

  it('can apply without a resume', async () => {
    serve();
    POST.mockResolvedValue(ok({ id: 'app-1' }));
    await renderApp(<JobDetail />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Apply' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'None' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Submit application' }));
    await waitFor(() => expect(POST.mock.calls[0][1].body.resume_id).toBeNull());
  });

  it('shows the server message when already applied, without closing the sheet', async () => {
    serve();
    POST.mockResolvedValue(fail(409, 'You already have an active application for this job'));
    await renderApp(<JobDetail />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Apply' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Submit application' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You already have an active application for this job',
    );
    expect(mockReplace).not.toHaveBeenCalled();
  });

  it('links to the existing application instead of offering to apply twice', async () => {
    serve({ apps: [{ id: 'app-3', status: 'under_review', job: { id: 'job-1' } }] });
    await renderApp(<JobDetail />);
    const btn = await screen.findByRole('button', { name: /Applied · under review — view/ });
    expect(screen.queryByRole('button', { name: 'Apply' })).toBeNull();
    await fireEvent.press(btn);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/application/[id]',
      params: { id: 'app-3' },
    });
  });

  it('sends external jobs to the employer’s site only after explaining nothing is tracked', async () => {
    serve({
      job: ok(
        job({
          origin: 'ingested',
          apply_url: 'https://careers.example.com/1',
          attribution: 'Example Feed',
          employer: { id: null, name: 'Pub Group', verification_status: null },
        }),
      ),
    });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await renderApp(<JobDetail />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Apply on employer site' }));
    expect(alert).toHaveBeenCalledTimes(1);
    const [, message, buttons] = alert.mock.calls[0] as [
      string,
      string,
      { text: string; onPress?: () => void }[],
    ];
    expect(message).toMatch(/cannot confirm they were received or viewed/);
    expect(mockOpenBrowser).not.toHaveBeenCalled();
    buttons.find((b) => b.text === 'Continue')!.onPress!();
    expect(mockOpenBrowser).toHaveBeenCalledWith('https://careers.example.com/1');
  });

  it('handles a job that has been taken down', async () => {
    serve({ job: fail(404, 'job not found') });
    await renderApp(<JobDetail />);
    expect(await screen.findByText('This job is no longer available')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: 'Back to search' }));
    expect(mockReplace).toHaveBeenCalledWith('/(app)/discover');
  });
});

it('retries an ambiguous submission with the same idempotency key', async () => {
  serve();
  POST.mockRejectedValueOnce(new Error('Network response lost')).mockResolvedValueOnce(
    ok({ id: 'app-9' }),
  );
  await renderApp(<JobDetail />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Apply' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Submit application' }));
  await screen.findByRole('alert');
  await fireEvent.press(screen.getByRole('button', { name: 'Submit application' }));
  await waitFor(() => expect(POST).toHaveBeenCalledTimes(2));
  expect(POST.mock.calls[0][1].headers['Idempotency-Key']).toBe(
    POST.mock.calls[1][1].headers['Idempotency-Key'],
  );
});
