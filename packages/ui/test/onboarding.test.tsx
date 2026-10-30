import { fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { GuidedSetup } from '../src/onboarding';
afterEach(cleanup);
function setup() {
  const action = vi.fn(async (_data: FormData) => {});
  render(
    <GuidedSetup
      action={action}
      submitLabel="Create workspace"
      steps={[
        {
          title: 'Account',
          description: 'Your sign-in',
          content: (
            <label>
              Name
              <input name="name" required />
            </label>
          ),
        },
        {
          title: 'Consent',
          description: 'Your choice',
          content: (
            <label>
              Accept terms
              <input name="terms" type="checkbox" required />
            </label>
          ),
        },
      ]}
    />,
  );
  return action;
}
it('does not create an account on Continue, preserves answers on Back, and submits all fields only after consent', async () => {
  const action = setup();
  fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Example Person' } });
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(action).not.toHaveBeenCalled();
  expect(screen.getByText('Step 2 of 2')).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Back' }));
  expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Example Person');
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
  expect(action).not.toHaveBeenCalled();
  fireEvent.click(screen.getByLabelText('Accept terms'));
  fireEvent.click(screen.getByRole('button', { name: 'Create workspace' }));
  await waitFor(() => expect(action).toHaveBeenCalledTimes(1));
  const data = action.mock.calls[0]![0];
  expect(data.get('name')).toBe('Example Person');
  expect(data.get('terms')).toBe('on');
});
it('keeps an invalid first step visible and does not invoke the server action', () => {
  const action = setup();
  fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
  expect(screen.getByText('Step 1 of 2')).toBeTruthy();
  expect(action).not.toHaveBeenCalled();
});
