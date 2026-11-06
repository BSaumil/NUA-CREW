import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import ForgotPassword from '../app/(auth)/forgot-password';
import { api } from '../src/api/client';
import { EmailVerificationCard } from '../src/ui/email-card';
import { fail, ok, renderApp } from './helpers';

jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  api: { GET: jest.fn(), POST: jest.fn() },
}));
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: unknown }) => children,
  useRouter: () => ({ push: jest.fn() }),
}));

const GET = api.GET as unknown as jest.Mock;
const POST = api.POST as unknown as jest.Mock;
beforeEach(() => {
  GET.mockReset();
  POST.mockReset();
});

describe('forgot password screen', () => {
  it('does not call the API for an invalid address', async () => {
    await renderApp(<ForgotPassword />);
    await fireEvent.press(screen.getByRole('button', { name: /reset link/i }));
    expect(POST).not.toHaveBeenCalled();
  });

  it('words a sent request without confirming that an account exists', async () => {
    POST.mockResolvedValue(ok({ status: 'accepted', email_delivery: true }));
    await renderApp(<ForgotPassword />);
    await fireEvent.changeText(screen.getByLabelText('Email'), ' Sam@Example.com ');
    await fireEvent.press(screen.getByRole('button', { name: /reset link/i }));
    await waitFor(() => expect(screen.getByText(/If an account exists/)).toBeTruthy());
    expect(POST.mock.calls[0][1].body).toEqual({ email: 'Sam@Example.com' });
  });

  it('says so honestly when email is not switched on', async () => {
    POST.mockResolvedValue(ok({ status: 'accepted', email_delivery: false }));
    await renderApp(<ForgotPassword />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'sam@example.com');
    await fireEvent.press(screen.getByRole('button', { name: /reset link/i }));
    await waitFor(() => expect(screen.getByText(/not switched on/)).toBeTruthy());
    expect(screen.queryByText(/If an account exists/)).toBeNull();
  });

  it('shows API errors', async () => {
    POST.mockResolvedValue(fail(429, 'Too many requests'));
    await renderApp(<ForgotPassword />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'sam@example.com');
    await fireEvent.press(screen.getByRole('button', { name: /reset link/i }));
    await waitFor(() => expect(screen.getByText(/Too many/)).toBeTruthy());
  });
});

describe('email verification card', () => {
  const me = (over = {}) => ok({ id: 'u', email: 'a@b.co', role: 'candidate', ...over });

  it('is hidden when the address is already confirmed', async () => {
    GET.mockResolvedValue(me({ email_verified: true, email_delivery: true }));
    await renderApp(<EmailVerificationCard />);
    await waitFor(() => expect(GET).toHaveBeenCalled());
    expect(screen.queryByText(/Confirm your email/)).toBeNull();
  });

  it('is hidden when this deployment cannot send email', async () => {
    GET.mockResolvedValue(me({ email_verified: false, email_delivery: false }));
    await renderApp(<EmailVerificationCard />);
    await waitFor(() => expect(GET).toHaveBeenCalled());
    expect(screen.queryByText(/Confirm your email/)).toBeNull();
  });

  it('offers a link when unverified and email works', async () => {
    GET.mockResolvedValue(me({ email_verified: false, email_delivery: true }));
    POST.mockResolvedValue(ok({ status: 'accepted', email_delivery: true }));
    await renderApp(<EmailVerificationCard />);
    await fireEvent.press(await screen.findByRole('button', { name: /confirmation link/i }));
    await waitFor(() => expect(screen.getByText(/emailed you a confirmation link/)).toBeTruthy());
  });
});
