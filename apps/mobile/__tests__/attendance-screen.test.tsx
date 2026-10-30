import { fireEvent, screen } from '@testing-library/react-native';
import { Attendance } from '../src/ui/attendance';
import { renderApp } from './helpers';
import type { Schemas } from '@nua-crew/contracts';
const mockMutate = jest.fn();
jest.mock('../src/api/shifts', () => ({
  useCandidateAttendance: () => ({ mutateAsync: mockMutate, isPending: false }),
  useReviewCorrection: () => ({ mutateAsync: mockMutate, isPending: false }),
  useTimesheetHistory: () => ({
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
}));
const booking = {
  id: 'b1',
  status: 'confirmed',
  shift: {
    id: 's1',
    title: 'Fictional shift',
    status: 'open',
    starts_at: '2026-10-30T01:00:00Z',
    ends_at: '2026-10-30T08:00:00Z',
    time_zone: 'Australia/Melbourne',
  },
  attendance: { status: 'not_started', events: [], pending_corrections: 0 },
} as unknown as Schemas['BookingOut'];
beforeEach(() => mockMutate.mockReset().mockResolvedValue({}));
it('does not check in until the worker confirms the server-time action', async () => {
  await renderApp(<Attendance booking={booking} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  expect(mockMutate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm attendance' }));
  expect(mockMutate).toHaveBeenCalledWith({ booking: 'b1', action: 'check-in', body: undefined });
});
it('uses venue-local correction fields and retains the typed reason after a network failure', async () => {
  mockMutate.mockRejectedValueOnce(new Error('offline'));
  await renderApp(<Attendance booking={booking} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Request attendance correction' }));
  await fireEvent.changeText(screen.getByLabelText('Correction reason'), 'Arrived earlier');
  await fireEvent.changeText(screen.getByLabelText('Correction date (YYYY-MM-DD)'), '2026-10-30');
  await fireEvent.changeText(screen.getByLabelText('Correction time (HH:MM)'), '11:50');
  await fireEvent.press(screen.getByRole('button', { name: 'Send correction for review' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm attendance' }));
  expect(mockMutate).toHaveBeenCalledWith({
    booking: 'b1',
    action: 'correction',
    body: {
      claim_kind: 'check_in',
      local_date: '2026-10-30',
      local_time: '11:50',
      reason: 'Arrived earlier',
    },
  });
  expect(screen.getByLabelText('Correction reason')).toHaveProp('value', 'Arrived earlier');
  expect(screen.getByRole('alert')).toBeOnTheScreen();
});

it('shows the actual interval, unpaid break and note for every hours version', async () => {
  await renderApp(<Attendance booking={booking} />);
  await fireEvent.press(screen.getByRole('button', { name: 'View hours history' }));
  expect(screen.getByText('Version 1 · submitted')).toBeOnTheScreen();
  expect(screen.getByText('390 worked minutes · 30 unpaid break minutes')).toBeOnTheScreen();
  expect(screen.getByText('Actual hours')).toBeOnTheScreen();
  expect(screen.getAllByText(/Australia\/Melbourne/).length).toBeGreaterThan(1);
});
