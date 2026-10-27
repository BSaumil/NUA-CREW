import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import ConversationScreen from '../app/conversation/[id]';
import { api } from '../src/api/client';
import { fail, ok, renderApp } from './helpers';

jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  api: { GET: jest.fn(), PUT: jest.fn(), DELETE: jest.fn(), POST: jest.fn() },
}));
const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'conv-1' }),
  useRouter: () => ({ push: jest.fn(), replace: mockReplace, back: jest.fn() }),
}));
const GET = api.GET as unknown as jest.Mock;
const POST = api.POST as unknown as jest.Mock;

const conv = (over = {}) => ({
  id: 'conv-1',
  employer_id: 'emp-1',
  invitation_id: 'inv-1',
  job_id: 'job-1',
  job_title: 'Barista',
  counterpart: 'Fitzroy Cafe',
  status: 'open',
  closed_reason: null,
  last_message_at: null,
  unread: false,
  ...over,
});
const msg = (id: string, body: string, mine = false) => ({
  id,
  sender_role: mine ? 'candidate' : 'employer',
  mine,
  body,
  created_at: new Date().toISOString(),
});

function serve(items: unknown[], c = conv(), next: string | null = null) {
  GET.mockImplementation(async (path: string) => {
    if (path === '/v1/candidate/conversations/{conversation_id}/messages')
      return ok({ items, next_before: next });
    if (path === '/v1/candidate/conversations') return ok([c]);
    throw new Error(`unexpected GET ${path}`);
  });
  POST.mockResolvedValue(ok({}));
}
beforeEach(() => {
  [GET, POST, mockReplace].forEach((m) => m.mockReset());
});

const sentKeys = () =>
  POST.mock.calls
    .filter(([p]) => p === '/v1/candidate/conversations/{conversation_id}/messages')
    .map(([, o]) => o.body.client_key);

it('shows messages as plain text, never as markup, and says it is not an offer', async () => {
  serve([msg('m1', 'Hello <b>there</b> & welcome'), msg('m2', 'Thanks!', true)]);
  await renderApp(<ConversationScreen />);
  expect(await screen.findByText('Hello <b>there</b> & welcome')).toBeTruthy();
  expect(screen.getByText(/Nothing here is a job offer or a shift booking/)).toBeTruthy();
  expect(screen.getByLabelText('Fitzroy Cafe: Hello <b>there</b> & welcome')).toBeTruthy();
  expect(screen.getByLabelText('You: Thanks!')).toBeTruthy();
});

it('marks the conversation read once it has loaded', async () => {
  serve([msg('m1', 'Hi')]);
  await renderApp(<ConversationScreen />);
  await screen.findByText('Hi');
  await waitFor(() =>
    expect(POST).toHaveBeenCalledWith('/v1/candidate/conversations/{conversation_id}/read', {
      params: { path: { conversation_id: 'conv-1' } },
    }),
  );
});

it('sends with a client key; a failed send keeps the text and retries with the SAME key', async () => {
  serve([]);
  await renderApp(<ConversationScreen />);
  const field = await screen.findByLabelText('Message');
  await fireEvent.changeText(field, '  Can I start Monday?  ');
  POST.mockImplementation(async (p: string) =>
    p.endsWith('/messages') ? fail(503, 'Service unavailable') : ok({}),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  expect(await screen.findByText(/Your message is still here: tap Send to try again/)).toBeTruthy();
  expect(screen.getByLabelText('Message').props.value).toBe('  Can I start Monday?  ');

  POST.mockImplementation(async () => ok(msg('m9', 'Can I start Monday?', true)));
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(screen.getByLabelText('Message').props.value).toBe(''));
  const keys = sentKeys();
  expect(keys).toHaveLength(2);
  expect(keys[0]).toBe(keys[1]);
  expect(POST.mock.calls.find(([p]) => p.endsWith('/messages'))![1].body.body).toBe(
    'Can I start Monday?',
  );

  // the next message is a new draft with a new key
  await fireEvent.changeText(screen.getByLabelText('Message'), 'Thanks');
  await fireEvent.press(screen.getByRole('button', { name: 'Send' }));
  await waitFor(() => expect(sentKeys()).toHaveLength(3));
  expect(sentKeys()[2]).not.toBe(keys[0]);
});

it('ignores a rapid double tap on Send', async () => {
  serve([]);
  let release!: () => void;
  const gate = new Promise<void>((r) => (release = r));
  await renderApp(<ConversationScreen />);
  await fireEvent.changeText(await screen.findByLabelText('Message'), 'Once only');
  POST.mockImplementation(async (p: string) => {
    if (p.endsWith('/messages')) await gate;
    return ok(msg('m1', 'Once only', true));
  });
  const send = screen.getByRole('button', { name: 'Send' });
  await fireEvent.press(send);
  await fireEvent.press(send);
  release();
  await waitFor(() => expect(sentKeys()).toHaveLength(1));
});

it('cannot send an empty message', async () => {
  serve([]);
  await renderApp(<ConversationScreen />);
  await screen.findByLabelText('Message');
  expect(screen.getByRole('button', { name: 'Send' })).toBeDisabled();
});

it('a closed conversation has no composer', async () => {
  serve([msg('m1', 'Bye')], conv({ status: 'closed', closed_reason: 'blocked' }));
  await renderApp(<ConversationScreen />);
  expect(await screen.findByText(/This conversation is closed/)).toBeTruthy();
  expect(screen.queryByLabelText('Message')).toBeNull();
});

it('reports a single message with a reason', async () => {
  serve([msg('m1', 'Send me your tax file number')]);
  await renderApp(<ConversationScreen />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Report this message' }));
  await fireEvent.changeText(
    await screen.findByLabelText('What is wrong? (to report)'),
    'Asks for TFN',
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send report to NUA CREW' }));
  await waitFor(() =>
    expect(POST).toHaveBeenCalledWith('/v1/candidate/conversations/{conversation_id}/report', {
      params: { path: { conversation_id: 'conv-1' } },
      body: { reason: 'Asks for TFN', message_id: 'm1' },
    }),
  );
  expect(await screen.findByText('Report sent to NUA CREW support.')).toBeTruthy();
});

it('loads earlier messages with the cursor', async () => {
  serve([msg('m2', 'Second')], conv(), 'm2');
  await renderApp(<ConversationScreen />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Load earlier messages' }));
  await waitFor(() =>
    expect(
      GET.mock.calls.some(
        ([p, o]) =>
          p === '/v1/candidate/conversations/{conversation_id}/messages' &&
          o.params.query.before === 'm2',
      ),
    ).toBe(true),
  );
});

it("another account's conversation (deep link after switching accounts) is unavailable", async () => {
  GET.mockResolvedValue(fail(404, 'conversation not found'));
  await renderApp(<ConversationScreen />);
  expect(await screen.findByText("This conversation isn't available")).toBeTruthy();
});
