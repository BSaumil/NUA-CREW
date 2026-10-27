import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import RegisterEmployer from '../app/(auth)/register-employer';
import { renderApp } from './helpers';

const mockRegister = jest.fn();
jest.mock('../src/state/AuthProvider', () => ({
  useAuth: () => ({ registerEmployer: mockRegister }),
}));
jest.mock('expo-router', () => ({
  Link: ({ children }: { children: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text accessibilityRole="link">{children}</Text>;
  },
}));
beforeEach(() => mockRegister.mockReset());

it('requires identity, business details and explicit terms consent before creating a workspace', async () => {
  await renderApp(<RegisterEmployer />);
  await fireEvent.press(screen.getByRole('button', { name: 'Create employer account' }));
  expect(mockRegister).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Your full name'), 'Sam Example');
  await fireEvent.changeText(screen.getByLabelText('Business name'), 'Fictional Cafe');
  await fireEvent.changeText(screen.getByLabelText('Work email'), ' owner@example.invalid ');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'a-long-password-123');
  await fireEvent.press(screen.getByRole('button', { name: 'Create employer account' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/Accept the terms/);
  expect(mockRegister).not.toHaveBeenCalled();
  await fireEvent(screen.getByLabelText('Accept terms and privacy notice'), 'valueChange', true);
  mockRegister.mockResolvedValue(undefined);
  await fireEvent.press(screen.getByRole('button', { name: 'Create employer account' }));
  await waitFor(() =>
    expect(mockRegister).toHaveBeenCalledWith(
      expect.objectContaining({
        full_name: 'Sam Example',
        organisation_name: 'Fictional Cafe',
        email: 'owner@example.invalid',
        client: 'mobile',
        accept_terms: true,
      }),
    ),
  );
});
