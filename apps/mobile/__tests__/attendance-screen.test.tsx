import { fireEvent, screen } from '@testing-library/react-native';
import type { Schemas } from '@nua-crew/contracts';
import { BookingHistory } from '../src/ui/booking-history';
import { renderApp } from './helpers';
const mockHistory = jest.fn();
jest.mock('../src/api/shifts', () => ({
  useTimesheetHistory: (...args: unknown[]) => mockHistory(...args),
}));
const booking = {
  id: 'b1',
  status: 'confirmed',
  shift: { time_zone: 'Australia/Melbourne' },
  attendance: { status: 'not_started', events: [] },
} as unknown as Schemas['BookingOut'];
beforeEach(() =>
  mockHistory.mockReturnValue({
    isPending: false,
    isError: false,
    data: [
      {
        version: 1,
        status: 'submitted',
        worked_minutes: 390,
        break_minutes: 30,
        starts_at: '2026-10-30T01:00:00Z',
        ends_at: '2026-10-30T08:00:00Z',
        recorded_at: '2026-10-30T08:01:00Z',
        note: 'Actual hours',
        review_note: null,
      },
    ],
    refetch: jest.fn(),
  }),
);
it('does not enable private history fetching until the person opens it', async () => {
  await renderApp(<BookingHistory booking={booking} />);
  expect(mockHistory).toHaveBeenLastCalledWith('b1', null, false);
  await fireEvent.press(screen.getByRole('button', { name: 'View hours history' }));
  expect(mockHistory).toHaveBeenLastCalledWith('b1', null, true);
});
it('shows a recoverable history error rather than a false empty history', async () => {
  mockHistory.mockReturnValue({
    isPending: false,
    isError: true,
    error: new Error('offline'),
    refetch: jest.fn(),
  });
  await renderApp(<BookingHistory booking={booking} />);
  await fireEvent.press(screen.getByRole('button', { name: 'View hours history' }));
  expect(screen.getByRole('button', { name: 'Try again' })).toBeOnTheScreen();
  expect(screen.queryByText('No hours submitted yet.')).toBeNull();
});
it('shows the actual interval, unpaid break and note for every hours version', async () => {
  await renderApp(<BookingHistory booking={booking} />);
  await fireEvent.press(screen.getByRole('button', { name: 'View hours history' }));
  expect(screen.getByText('Version 1 · submitted')).toBeOnTheScreen();
  expect(screen.getByText('390 worked minutes · 30 unpaid break minutes')).toBeOnTheScreen();
  expect(screen.getByText('Actual hours')).toBeOnTheScreen();
  expect(screen.getAllByText(/Australia\/Melbourne/).length).toBeGreaterThan(1);
});
