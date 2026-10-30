import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import Login from '../app/(auth)/login';
import Register from '../app/(auth)/register';
import { ApiFailure } from '../src/api/client';
import { renderApp } from './helpers';

const mockSignIn = jest.fn();
const mockRegister = jest.fn();
jest.mock('../src/state/AuthProvider', () => ({
  useAuth: () => ({ signIn: mockSignIn, register: mockRegister }),
}));
jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Link: ({ children }: { children: string }) => <Text accessibilityRole="link">{children}</Text>,
  };
});

beforeEach(() => {
  mockSignIn.mockReset();
  mockRegister.mockReset();
});

const type = (label: string, value: string) =>
  fireEvent.changeText(screen.getByLabelText(label), value);

describe('Login', () => {
  it('validates before calling the API and shows field errors', async () => {
    await renderApp(<Login />);
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(screen.getByText('Enter your email')).toBeOnTheScreen();
    expect(screen.getByText('Enter your password')).toBeOnTheScreen();
    expect(mockSignIn).not.toHaveBeenCalled();
    await type('Email', 'not-an-email');
    expect(screen.getByText('Enter a valid email address')).toBeOnTheScreen();
  });

  it('signs in with a trimmed email and does not echo the password anywhere', async () => {
    mockSignIn.mockResolvedValue(undefined);
    await renderApp(<Login />);
    await type('Email', '  alex@example.com ');
    await type('Password', 'hunter2-hunter2');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() =>
      expect(mockSignIn).toHaveBeenCalledWith('alex@example.com', 'hunter2-hunter2'),
    );
    expect(screen.queryByText('hunter2-hunter2')).toBeNull();
    expect(screen.getByLabelText('Password')).toHaveProp('secureTextEntry', true);
  });

  it('announces server errors as alerts and recovers', async () => {
    mockSignIn.mockRejectedValueOnce(
      new ApiFailure('Email or password is incorrect', 401, 'invalid_credentials'),
    );
    await renderApp(<Login />);
    await type('Email', 'alex@example.com');
    await type('Password', 'wrong-password-1');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Email or password is incorrect');
    mockSignIn.mockResolvedValueOnce(undefined);
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
  });

  it('explains a network failure in plain language', async () => {
    mockSignIn.mockRejectedValueOnce(new TypeError('Network request failed'));
    await renderApp(<Login />);
    await type('Email', 'alex@example.com');
    await type('Password', 'whatever-password');
    await fireEvent.press(screen.getByRole('button', { name: 'Log in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach NUA CREW/i);
  });
});

describe('Register', () => {
  it('requires a name, valid email, a 12+ character password and agreement to the terms', async () => {
    await renderApp(<Register />);
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter your name')).toBeOnTheScreen();
    expect(screen.getByText('Enter your email')).toBeOnTheScreen();
    expect(screen.getByText('Enter your password')).toBeOnTheScreen();
    expect(screen.queryByRole('button', { name: 'Create account' })).toBeNull();
    await type('Password', 'short');
    expect(screen.getByText('Use at least 12 characters')).toBeOnTheScreen();
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('submits once everything is valid', async () => {
    mockRegister.mockResolvedValue(undefined);
    await renderApp(<Register />);
    await type('Full name', ' Alex Candidate ');
    await type('Email', 'alex@example.com');
    await type('Password', 'a-long-enough-password');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    expect(mockRegister).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('You need to accept the terms to continue');
    await fireEvent(
      screen.getByLabelText('I agree to the terms and understand how my data is used'),
      'valueChange',
      true,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith({
        fullName: 'Alex Candidate',
        email: 'alex@example.com',
        password: 'a-long-enough-password',
      }),
    );
  });
});
