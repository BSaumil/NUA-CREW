import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import AvailabilityScreen from '../app/availability';
import EmployerPreferences from '../app/employer-preferences';
import { api } from '../src/api/client';
import { fail, ok, renderApp } from './helpers';

jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  api: { GET: jest.fn(), PUT: jest.fn(), DELETE: jest.fn(), POST: jest.fn() },
}));
const GET = api.GET as unknown as jest.Mock;
const PUT = api.PUT as unknown as jest.Mock;
const POST = api.POST as unknown as jest.Mock;
const DELETE = api.DELETE as unknown as jest.Mock;

const availability = (over = {}) => ({
  time_zone: 'Australia/Melbourne',
  rules: [],
  exceptions: [],
  commitments: [],
  weekly_hours: null,
  ...over,
});
const rule = (weekday: number, a: string, b: string) => ({
  id: `${weekday}${a}`,
  weekday,
  start_time: `${a}:00`,
  end_time: `${b}:00`,
});

beforeEach(() => {
  [GET, PUT, POST, DELETE].forEach((m) => m.mockReset());
});

describe('availability editor', () => {
  it('explains that nothing shared means unknown, not available', async () => {
    GET.mockResolvedValue(ok(availability()));
    await renderApp(<AvailabilityScreen />);
    expect(await screen.findByText(/availability unknown/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Weekly availability saved' })).toBeDisabled();
  });

  it('adds several windows to one day, including an overnight one, then saves', async () => {
    GET.mockResolvedValue(ok(availability()));
    PUT.mockResolvedValue(ok(availability()));
    await renderApp(<AvailabilityScreen />);
    const add = async (day: string, from: string, to: string) => {
      await fireEvent.press(await screen.findByRole('button', { name: `Add a time on ${day}` }));
      await fireEvent.changeText(await screen.findByLabelText('From'), from);
      await fireEvent.changeText(screen.getByLabelText('Until'), to);
      await fireEvent.press(screen.getByRole('button', { name: 'Add time' }));
      await waitFor(() => expect(screen.queryByText(`Add a time on ${day}`)).toBeNull());
    };
    await add('Tuesday', '9am', '12pm');
    await add('Tuesday', '2pm', '6pm');
    await add('Saturday', '10pm', '6am');
    expect(screen.getByText('9:00 am to 12:00 pm')).toBeTruthy();
    expect(screen.getByText('2:00 pm to 6:00 pm')).toBeTruthy();
    expect(screen.getByText('10:00 pm to 6:00 am (next day)')).toBeTruthy();

    await fireEvent.press(screen.getByRole('button', { name: 'Save weekly availability' }));
    await waitFor(() => expect(PUT).toHaveBeenCalledTimes(1));
    const [path, opts] = PUT.mock.calls[0]!;
    expect(path).toBe('/v1/candidate/availability/rules');
    expect(opts.body.time_zone).toBe('Australia/Melbourne');
    expect(opts.body.rules).toEqual(
      expect.arrayContaining([
        { weekday: 1, start_time: '09:00', end_time: '12:00' },
        { weekday: 1, start_time: '14:00', end_time: '18:00' },
        { weekday: 5, start_time: '22:00', end_time: '06:00' },
      ]),
    );
  });

  it('rejects an overlapping window in the sheet and keeps what was typed', async () => {
    GET.mockResolvedValue(ok(availability({ rules: [rule(1, '09:00', '12:00')] })));
    await renderApp(<AvailabilityScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Add a time on Tuesday' }));
    await fireEvent.changeText(await screen.findByLabelText('From'), '11am');
    await fireEvent.changeText(screen.getByLabelText('Until'), '1pm');
    await fireEvent.press(screen.getByRole('button', { name: 'Add time' }));
    expect(await screen.findByText(/That overlaps another window/)).toBeTruthy();
    expect(screen.getByLabelText('From').props.value).toBe('11am');
    await fireEvent.changeText(screen.getByLabelText('From'), '');
    await fireEvent.press(screen.getByRole('button', { name: 'Add time' }));
    expect(await screen.findByText(/Enter a time like 9:00 am/)).toBeTruthy();
  });

  it('removes a window with an unambiguous accessible label', async () => {
    GET.mockResolvedValue(ok(availability({ rules: [rule(1, '09:00', '12:00')] })));
    await renderApp(<AvailabilityScreen />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Remove Tuesday 9:00 am to 12:00 pm' }),
    );
    expect(screen.queryByText('9:00 am to 12:00 pm')).toBeNull();
    expect(screen.getByRole('button', { name: 'Save weekly availability' })).toBeEnabled();
  });

  it('adds a "not available" day off in Australian date format', async () => {
    GET.mockResolvedValue(ok(availability()));
    POST.mockResolvedValue(ok({}));
    await renderApp(<AvailabilityScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Add a one-off change' }));
    await fireEvent.changeText(await screen.findByLabelText('First day'), '24/12/2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Save change' }));
    await waitFor(() => expect(POST).toHaveBeenCalledTimes(1));
    expect(POST.mock.calls[0]![1].body).toEqual({
      state: 'unavailable',
      start_date: '2026-12-24',
      end_date: '2026-12-24',
      start_time: null,
      end_time: null,
    });
  });

  it('shows validation errors for a bad one-off change without losing input', async () => {
    GET.mockResolvedValue(ok(availability()));
    await renderApp(<AvailabilityScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Add a one-off change' }));
    await fireEvent.changeText(await screen.findByLabelText('First day'), '31/2/2026');
    await fireEvent.press(screen.getByRole('button', { name: 'Only some hours' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Save change' }));
    expect(await screen.findByText('Use a date like 24/12/2026')).toBeTruthy();
    expect(await screen.findByText('Enter a time like 9:00 am')).toBeTruthy();
    expect(POST).not.toHaveBeenCalled();
    expect(screen.getByLabelText('First day').props.value).toBe('31/2/2026');
  });

  it('shows the server message when booked work conflicts, keeping the form', async () => {
    GET.mockResolvedValue(ok(availability()));
    POST.mockResolvedValue(fail(409, 'That overlaps work you have already confirmed'));
    await renderApp(<AvailabilityScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Add booked work' }));
    await fireEvent.changeText(await screen.findByLabelText('Date'), '3/11/2026');
    await fireEvent.changeText(screen.getByLabelText('From'), '10am');
    await fireEvent.changeText(screen.getByLabelText('Until'), '2pm');
    await fireEvent.press(screen.getByRole('button', { name: 'Add booking' }));
    expect(await screen.findByText(/already confirmed/)).toBeTruthy();
    expect(POST.mock.calls[0]![1].body).toMatchObject({
      local_date: '2026-11-03',
      local_start: '10:00',
      local_end: '14:00',
      status: 'confirmed',
    });
    expect(screen.getByLabelText('Date').props.value).toBe('3/11/2026');
  });

  it('keeps unsaved weekly changes when saving fails', async () => {
    GET.mockResolvedValue(ok(availability({ rules: [rule(1, '09:00', '12:00')] })));
    PUT.mockResolvedValue(fail(503, 'Service unavailable'));
    await renderApp(<AvailabilityScreen />);
    await fireEvent.press(
      await screen.findByRole('button', { name: 'Remove Tuesday 9:00 am to 12:00 pm' }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Save weekly availability' }));
    expect(await screen.findByText(/Your changes are still here/)).toBeTruthy();
    expect(screen.queryByText('9:00 am to 12:00 pm')).toBeNull();
  });
});

describe('employer preferences', () => {
  const emp = { id: 'e1', name: 'Fitzroy Cafe', verification_status: 'verified' };
  it('finds an employer and records a hide-from choice; removing it asks the server', async () => {
    GET.mockImplementation(async (path: string) => {
      if (path === '/v1/candidate/employer-preferences')
        return ok([{ id: 'p1', employer_id: 'e2', employer_name: 'Old Bar', kind: 'mute' }]);
      if (path === '/v1/candidate/employer-directory') return ok([emp]);
      throw new Error(path);
    });
    POST.mockResolvedValue(ok({}));
    DELETE.mockResolvedValue({ response: { ok: true, status: 204 } });
    await renderApp(<EmployerPreferences />);
    expect(await screen.findByText('Jobs muted: Old Bar')).toBeTruthy();
    expect(screen.getByText(/can't promise you stay unseen/)).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Find an employer by name'), 'Fitz');
    const hide = await screen.findByRole('button', { name: 'Hide me' });
    await fireEvent.press(hide);
    await waitFor(() =>
      expect(POST).toHaveBeenCalledWith('/v1/candidate/employer-preferences', {
        body: { employer_id: 'e1', kind: 'hide_from' },
      }),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Remove jobs muted Old Bar' }));
    await waitFor(() => expect(DELETE).toHaveBeenCalledTimes(1));
  });
});
