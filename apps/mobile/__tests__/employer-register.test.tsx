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
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(mockRegister).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Your full name'), 'Sam Example');
  await fireEvent.changeText(screen.getByLabelText('Work email'), ' owner@example.invalid ');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'a-long-password-123');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter your business name');
  await fireEvent.changeText(screen.getByLabelText('Business name'), 'Fictional Cafe');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('alert')).toHaveTextContent('Enter your ABN');
  await fireEvent.changeText(screen.getByLabelText('ABN'), '12345678901');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByRole('alert')).toHaveTextContent(/does not look right/);
  await fireEvent.changeText(screen.getByLabelText('ABN'), '51 824 753 556');
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(screen.getByLabelText('Work email')).toHaveProp('value', ' owner@example.invalid ');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByLabelText('Business name')).toHaveProp('value', 'Fictional Cafe');
  expect(screen.getByLabelText('ABN')).toHaveProp('value', '51 824 753 556');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
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
        abn: '51824753556',
        email: 'owner@example.invalid',
        client: 'mobile',
        accept_terms: true,
      }),
    ),
  );
});

async function reachBusinessStep() {
  await renderApp(<RegisterEmployer />);
  await fireEvent.changeText(screen.getByLabelText('Your full name'), 'Sam Example');
  await fireEvent.changeText(screen.getByLabelText('Work email'), 'owner@example.invalid');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'a-long-password-123');
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await fireEvent.changeText(screen.getByLabelText('Business name'), 'Fictional Cafe');
  await fireEvent.changeText(screen.getByLabelText('ABN'), '51824753556');
}
async function finish() {
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
  await fireEvent(screen.getByLabelText('Accept terms and privacy notice'), 'valueChange', true);
  await fireEvent.press(screen.getByRole('button', { name: 'Create employer account' }));
}

describe('first venue at sign-up (matches the website)', () => {
  it('is optional: no venue means no location is sent', async () => {
    mockRegister.mockResolvedValue(undefined);
    await reachBusinessStep();
    await finish();
    await waitFor(() => expect(mockRegister).toHaveBeenCalled());
    expect(mockRegister.mock.calls[0][0]).not.toHaveProperty('location');
  });

  it('sends a complete venue, defaulting the name like the website does', async () => {
    mockRegister.mockResolvedValue(undefined);
    await reachBusinessStep();
    await fireEvent.changeText(screen.getByLabelText('Suburb'), ' Fitzroy ');
    await fireEvent.press(screen.getByRole('button', { name: 'VIC' }));
    await fireEvent.changeText(screen.getByLabelText('Postcode'), '3065');
    await finish();
    await waitFor(() =>
      expect(mockRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          location: { name: 'Main location', suburb: 'Fitzroy', state: 'VIC', postcode: '3065' },
        }),
      ),
    );
  });

  it('refuses a half-filled venue with a reason and sends nothing', async () => {
    await reachBusinessStep();
    await fireEvent.changeText(screen.getByLabelText('Suburb'), 'Fitzroy');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Choose the venue state or territory');
    await fireEvent.press(screen.getByRole('button', { name: 'VIC' }));
    await fireEvent.changeText(screen.getByLabelText('Postcode'), '30');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Enter a four-digit postcode');
    expect(mockRegister).not.toHaveBeenCalled();
  });

  it('lets a chosen state be cleared again', async () => {
    mockRegister.mockResolvedValue(undefined);
    await reachBusinessStep();
    await fireEvent.press(screen.getByRole('button', { name: 'VIC' }));
    await fireEvent.press(screen.getByRole('button', { name: 'VIC' }));
    await finish(); // nothing else entered, so the venue is simply absent
    await waitFor(() => expect(mockRegister).toHaveBeenCalled());
    expect(mockRegister.mock.calls[0][0]).not.toHaveProperty('location');
  });
});
