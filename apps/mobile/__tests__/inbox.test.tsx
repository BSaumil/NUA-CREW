import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Inbox from '../app/(app)/inbox';
import InvitationDetail from '../app/invitation/[id]';
import { api } from '../src/api/client';
import { fail, ok, renderApp } from './helpers';

jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  api: { GET: jest.fn(), PUT: jest.fn(), DELETE: jest.fn(), POST: jest.fn() },
}));
const mockPush = jest.fn();
const mockReplace = jest.fn();
const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ id: 'inv-1' }),
  useRouter: () => ({ push: mockPush, replace: mockReplace, back: mockBack }),
}));
const GET = api.GET as unknown as jest.Mock;
const POST = api.POST as unknown as jest.Mock;
const PUT = api.PUT as unknown as jest.Mock;

const terms = (over = {}) => ({
  business: 'Fitzroy Cafe',
  job_id: 'job-1',
  title: 'Barista',
  suburb: 'Fitzroy',
  state: 'VIC',
  employment_type: 'casual',
  engagement_basis: 'employee',
  duration_type: 'unspecified',
  hours_pattern: 'casual',
  min_weekly_hours: null,
  max_weekly_hours: null,
  start_date: null,
  end_date: null,
  pay_min: '28.00',
  pay_max: '32.00',
  pay_period: 'hour',
  pay_basis: 'disclosed',
  super_included: false,
  ...over,
});
const inv = (over = {}) => ({
  id: 'inv-1',
  employer_id: 'emp-1',
  status: 'pending',
  kind: 'temporary',
  note: 'We would love to have you.',
  created_at: new Date().toISOString(),
  expires_at: new Date(Date.now() + 5 * 86_400_000).toISOString(),
  responded_at: null,
  unread: true,
  terms: terms(),
  current_terms: terms(),
  current_terms_hash: 'hash-now-0001',
  terms_changed: false,
  job_open: true,
  can_accept: true,
  conversation_id: null,
  acceptance_note:
    'Accepting opens a conversation with this employer. It is not an application, does not accept any employment, does not reserve a shift and shares no contact details, resume or calendar.',
  ...over,
});

beforeEach(() => {
  [GET, POST, PUT, mockPush, mockReplace, mockBack].forEach((m) => m.mockReset());
  jest.restoreAllMocks();
});

describe('Inbox', () => {
  function serve(invitations: unknown[], conversations: unknown[] = [], enabled = true) {
    GET.mockImplementation(async (path: string) => {
      if (path === '/v1/candidate/invitations')
        return ok({
          items: invitations,
          unread: invitations.filter((i) => (i as { unread: boolean }).unread).length,
        });
      if (path === '/v1/candidate/conversations') return ok(conversations);
      if (path === '/v1/candidate/invitation-settings') return ok({ invitations_enabled: enabled });
      throw new Error(`unexpected GET ${path}`);
    });
  }

  it('shows an honest empty state', async () => {
    serve([]);
    await renderApp(<Inbox />);
    expect(await screen.findByText('No invitations yet')).toBeTruthy();
    expect(screen.getByText(/You decide whether to reply/)).toBeTruthy();
  });

  it('lists invitations with an accessible summary and opens the detail', async () => {
    serve([inv()]);
    await renderApp(<Inbox />);
    const card = await screen.findByRole('button', {
      name: /New\. Invitation from Fitzroy Cafe for Barista\. Waiting for you\./,
    });
    await fireEvent.press(card);
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/invitation/[id]',
      params: { id: 'inv-1' },
    });
    expect(screen.getByRole('tab', { name: 'Invitations (1 new)' })).toBeTruthy();
  });

  it('shows conversations and the closed state', async () => {
    serve(
      [],
      [
        {
          id: 'c1',
          employer_id: 'e',
          invitation_id: 'i',
          job_id: 'j',
          job_title: 'Barista',
          counterpart: 'Fitzroy Cafe',
          status: 'closed',
          closed_reason: 'candidate_closed',
          last_message_at: null,
          unread: false,
        },
      ],
    );
    await renderApp(<Inbox />);
    await fireEvent.press(await screen.findByRole('tab', { name: 'Messages' }));
    expect(
      await screen.findByRole('button', {
        name: /Conversation with Fitzroy Cafe about Barista, closed/,
      }),
    ).toBeTruthy();
  });

  it('pausing new invitations asks the server and explains what stays', async () => {
    serve([]);
    PUT.mockResolvedValue(ok({ invitations_enabled: false }));
    await renderApp(<Inbox />);
    expect(await screen.findByText(/Pausing stops new ones only/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Pause new invitations' }));
    await waitFor(() =>
      expect(PUT).toHaveBeenCalledWith('/v1/candidate/invitation-settings', {
        body: { enabled: false },
      }),
    );
    expect(await screen.findByRole('button', { name: 'Allow invitations again' })).toBeTruthy();
  });

  it('shows a retryable error when loading fails', async () => {
    GET.mockResolvedValue(fail(503, 'Service unavailable'));
    await renderApp(<Inbox />);
    expect(await screen.findByText(/Service unavailable|reach NUA CREW/)).toBeTruthy();
  });
});

describe('Invitation detail', () => {
  const serve = (i: unknown) => GET.mockResolvedValue(ok(i));

  it('states what accepting does and does not do, then accepts with the reviewed hash', async () => {
    serve(inv());
    POST.mockResolvedValue(ok(inv({ status: 'accepted', conversation_id: 'conv-1' })));
    await renderApp(<InvitationDetail />);
    expect(await screen.findByText('Fitzroy Cafe invited you')).toBeTruthy();
    expect(screen.getByText(/not an application, does not accept any employment/)).toBeTruthy();
    expect(screen.getByText('We would love to have you.')).toBeTruthy();
    expect(screen.getByText("You don't need to give a reason.")).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Accept and open a conversation' }));
    await waitFor(() =>
      expect(POST).toHaveBeenCalledWith('/v1/candidate/invitations/{invitation_id}/accept', {
        params: { path: { invitation_id: 'inv-1' } },
        body: { terms_hash: 'hash-now-0001' },
      }),
    );
  });

  it('declines without asking for a reason', async () => {
    serve(inv());
    POST.mockResolvedValue(ok(inv({ status: 'declined' })));
    await renderApp(<InvitationDetail />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Decline' }));
    await waitFor(() =>
      expect(POST).toHaveBeenCalledWith('/v1/candidate/invitations/{invitation_id}/decline', {
        params: { path: { invitation_id: 'inv-1' } },
      }),
    );
    expect(mockBack).toHaveBeenCalled();
  });

  it('shows what changed and makes the person review the latest terms', async () => {
    serve(
      inv({
        terms_changed: true,
        current_terms: terms({ pay_max: '36.00' }),
        current_terms_hash: 'hash-new-0002',
      }),
    );
    POST.mockResolvedValue(fail(409, 'The job details changed. Please review the latest details.'));
    await renderApp(<InvitationDetail />);
    expect(
      await screen.findByText('The job details changed since this invitation was sent'),
    ).toBeTruthy();
    expect(screen.getByText(/Pay: was .*32.*now .*36/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Accept the updated details' }));
    expect(POST.mock.calls[0]![1].body).toEqual({ terms_hash: 'hash-new-0002' });
    expect(await screen.findByText(/review the latest details/)).toBeTruthy();
  });

  it('cannot accept a job that is no longer open', async () => {
    serve(inv({ job_open: false, can_accept: false }));
    await renderApp(<InvitationDetail />);
    expect(await screen.findByText('This job is no longer open.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Accept and open a conversation' })).toBeDisabled();
  });

  it('an expired invitation offers no actions', async () => {
    serve(inv({ status: 'expired', can_accept: false }));
    await renderApp(<InvitationDetail />);
    expect(await screen.findByText(/This invitation expired/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Accept/ })).toBeNull();
  });

  it('after accepting, offers the conversation', async () => {
    serve(inv({ status: 'accepted', conversation_id: 'conv-1' }));
    await renderApp(<InvitationDetail />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Open conversation' }));
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/conversation/[id]',
      params: { id: 'conv-1' },
    });
  });

  it("another account's invitation (a deep link after switching accounts) is simply unavailable", async () => {
    GET.mockResolvedValue(fail(404, 'invitation not found'));
    await renderApp(<InvitationDetail />);
    expect(await screen.findByText("This invitation isn't available")).toBeTruthy();
    expect(screen.queryByText(/Fitzroy Cafe/)).toBeNull();
  });

  it('blocking asks first and then blocks that employer by id', async () => {
    serve(inv());
    POST.mockResolvedValue(ok({}));
    await renderApp(<InvitationDetail />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Block Fitzroy Cafe' }));
    expect(await screen.findByText('Block Fitzroy Cafe?')).toBeTruthy();
    expect(POST).not.toHaveBeenCalled(); // nothing happens until confirmed
    await fireEvent.press(screen.getByRole('button', { name: 'Block' }));
    await waitFor(() =>
      expect(POST).toHaveBeenCalledWith('/v1/candidate/employer-preferences', {
        body: { employer_id: 'emp-1', kind: 'block' },
      }),
    );
  });

  it('cancelling the block confirmation changes nothing', async () => {
    serve(inv());
    await renderApp(<InvitationDetail />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Block Fitzroy Cafe' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Cancel' }));
    expect(POST).not.toHaveBeenCalled();
  });
});
