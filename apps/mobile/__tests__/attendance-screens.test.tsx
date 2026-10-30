import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import type { Schemas } from '@nua-crew/contracts';
import { api } from '../src/api/client';
import { CandidateAttendance, EmployerAttendance } from '../src/ui/attendance';
import { ok, renderApp } from './helpers';

jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  api: { GET: jest.fn(), POST: jest.fn() },
}));
jest.mock('../src/state/HireWorkspace', () => ({
  useHireWorkspace: () => ({ employerId: 'e1', role: 'owner', pending: false, error: null }),
}));
const POST = api.POST as unknown as jest.Mock;

const HOUR = 3_600_000;
const shiftAround = (startOffsetHours: number, lengthHours = 4) => ({
  id: 's1',
  title: 'Evening service',
  starts_at: new Date(Date.now() + startOffsetHours * HOUR).toISOString(),
  ends_at: new Date(Date.now() + (startOffsetHours + lengthHours) * HOUR).toISOString(),
  time_zone: 'Australia/Melbourne',
  hourly_rate_minor: 3385,
  super_included: false,
});
const booking = (shift: ReturnType<typeof shiftAround>, attendance: object | null = null) =>
  ({
    id: 'b1',
    shift,
    candidate_label: 'Alex C.',
    status: 'confirmed',
    expires_at: shift.ends_at,
    reason: null,
    timesheet: null,
    attendance,
  }) as unknown as Schemas['BookingOut'];
const attendance = (over: object = {}) => ({
  status: 'not_started',
  check_in_at: null,
  check_out_at: null,
  venue_time_zone: 'Australia/Melbourne',
  pending_corrections: 0,
  events: [],
  ...over,
});

beforeEach(() => {
  POST.mockReset();
});

describe('worker attendance', () => {
  it('offers check in only inside the window and sends no time of its own', async () => {
    POST.mockResolvedValue(ok(booking(shiftAround(-1), attendance())));
    await renderApp(<CandidateAttendance booking={booking(shiftAround(-1), attendance())} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Check in to Evening service' }));
    await waitFor(() => expect(POST).toHaveBeenCalledTimes(1));
    const [path, init] = POST.mock.calls[0];
    expect(path).toBe('/v1/candidate/shift-bookings/{booking_id}/check-in');
    expect(init.body).toBeUndefined();
    expect(init.params.path.booking_id).toBe('b1');
  });

  it('says check in is not open yet and shows no button', async () => {
    await renderApp(<CandidateAttendance booking={booking(shiftAround(5), attendance())} />);
    expect(screen.getByText(/opens one hour before/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Check in to/ })).toBeNull();
  });

  it('offers check out after check in, and shows the server error if it is refused', async () => {
    const b = booking(
      shiftAround(-2),
      attendance({ status: 'checked_in', check_in_at: new Date(Date.now() - HOUR).toISOString() }),
    );
    POST.mockResolvedValue({
      data: undefined,
      error: { error: { code: 'check_out_window', message: 'Request a correction' } },
      response: { ok: false, status: 409 },
    });
    await renderApp(<CandidateAttendance booking={b} />);
    expect(screen.queryByRole('button', { name: /Check in to/ })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Check out of Evening service' }));
    await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  });

  it('sends a correction with an instant and a reason, and rejects a vague one', async () => {
    const shift = shiftAround(-3);
    POST.mockResolvedValue(ok(booking(shift, attendance())));
    await renderApp(<CandidateAttendance booking={booking(shift, attendance())} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ask for a correction' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Send correction' }));
    expect(await screen.findByText('Add a short reason.')).toBeTruthy();
    expect(POST).not.toHaveBeenCalled();
    await fireEvent.changeText(await screen.findByLabelText('Why'), 'Phone died at the door');
    await fireEvent.press(await screen.findByRole('button', { name: 'Send correction' }));
    await waitFor(() => expect(POST).toHaveBeenCalledTimes(1));
    const [path, init] = POST.mock.calls[0];
    expect(path).toBe('/v1/candidate/shift-bookings/{booking_id}/attendance-corrections');
    expect(init.body).toMatchObject({ claim_kind: 'check_in', reason: 'Phone died at the door' });
    expect(init.body.claimed_at).toMatch(/Z$/);
  });
});

describe('business attendance', () => {
  const pending = {
    id: 'ev1',
    kind: 'correction_requested',
    actor_role: 'candidate',
    recorded_at: new Date().toISOString(),
    claimed_at: new Date(Date.now() - HOUR).toISOString(),
    claim_kind: 'check_in',
    ref_event_id: null,
    time_zone: 'Australia/Melbourne',
    note: 'Phone died',
  };

  it('needs a note, then asks for confirmation before deciding a correction', async () => {
    const b = booking(shiftAround(-3), attendance({ pending_corrections: 1, events: [pending] }));
    POST.mockResolvedValue(ok(b));
    await renderApp(<EmployerAttendance booking={b} editable />);
    expect(screen.getByText(/Phone died/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Approve correction from Alex C.' }));
    expect(await screen.findByText(/Add a short note first/)).toBeTruthy();
    expect(POST).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByLabelText('Note to Alex C.'), 'Fine, thanks');
    await fireEvent.press(screen.getByRole('button', { name: 'Approve correction from Alex C.' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Confirm' }));
    await waitFor(() => expect(POST).toHaveBeenCalledTimes(1));
    const [path, init] = POST.mock.calls[0];
    expect(path).toContain('/attendance-corrections/{event_id}/review');
    expect(init.params.path.event_id).toBe('ev1');
    expect(init.body).toEqual({ decision: 'approved', reason: 'Fine, thanks' });
  });

  it('does not offer a no-show mark inside the grace period', async () => {
    await renderApp(
      <EmployerAttendance booking={booking(shiftAround(-0.2), attendance())} editable />,
    );
    expect(screen.queryByRole('button', { name: /Mark no-show/ })).toBeNull();
  });

  it('offers a no-show mark once the grace period has passed', async () => {
    await renderApp(
      <EmployerAttendance booking={booking(shiftAround(-2), attendance())} editable />,
    );
    expect(await screen.findByRole('button', { name: 'Mark no-show for Alex C.' })).toBeTruthy();
  });

  it('offers a reversal once a no-show is marked', async () => {
    const marked = booking(shiftAround(-2), attendance({ status: 'no_show' }));
    await renderApp(<EmployerAttendance booking={marked} editable />);
    expect(await screen.findByRole('button', { name: 'Reverse no-show for Alex C.' })).toBeTruthy();
  });

  it('shows read-only viewers the facts but no controls', async () => {
    const b = booking(shiftAround(-3), attendance({ pending_corrections: 1, events: [pending] }));
    await renderApp(<EmployerAttendance booking={b} editable={false} />);
    expect(screen.getByText(/Phone died/)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
