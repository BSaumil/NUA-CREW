import { fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import WorkPreferences from '../app/work-preferences';
import { api } from '../src/api/client';
import { fail, ok, renderApp } from './helpers';

jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  api: { GET: jest.fn(), PUT: jest.fn(), DELETE: jest.fn(), POST: jest.fn() },
}));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));
const GET = api.GET as unknown as jest.Mock;
const PUT = api.PUT as unknown as jest.Mock;

const pref = (kind: string, over = {}) => ({
  kind,
  enabled: true,
  discoverable: false,
  engagement_bases: [],
  hours_patterns: [],
  min_weekly_hours: null,
  max_weekly_hours: null,
  min_hourly_pay: null,
  max_travel_km: null,
  notice_period_days: null,
  available_from: null,
  ...over,
});
const profile = (discoverable = false) => ({
  id: 'p1',
  full_name: 'Sam Kay',
  discoverable,
  skills: [],
  preferred_employment_types: [],
});

function serve(prefs: { permanent: unknown; temporary: unknown }, discoverable = false) {
  GET.mockImplementation(async (path: string) => {
    if (path === '/v1/candidate/work-preferences') return ok(prefs);
    if (path === '/v1/candidate/profile') return ok(profile(discoverable));
    throw new Error(`unexpected GET ${path}`);
  });
}
beforeEach(() => {
  [GET, PUT, mockPush].forEach((m) => m.mockReset());
  PUT.mockImplementation(async (_p: string, o: { params: { path: { kind: string } } }) =>
    ok(pref(o.params.path.kind)),
  );
});

const chip = (name: string) => screen.getByRole('button', { name });

it('starts with nothing chosen and says employers cannot find the person', async () => {
  serve({ permanent: null, temporary: null });
  await renderApp(<WorkPreferences />);
  expect(await screen.findByText(/Employers can't find you/)).toBeTruthy();
  expect(screen.queryByText('Permanent work')).toBeNull();
});

it('Both shows two separate forms and saves each one without touching the other', async () => {
  serve({ permanent: null, temporary: null });
  await renderApp(<WorkPreferences />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Both' }));
  expect(screen.getByText('Permanent work')).toBeTruthy();
  expect(screen.getByText('Temporary work')).toBeTruthy();

  const fields = screen.getAllByLabelText("Lowest hourly pay you'd consider");
  await fireEvent.changeText(fields[0]!, '40');
  await fireEvent.changeText(fields[1]!, '30');
  await fireEvent.changeText(screen.getByLabelText('Notice period (days)'), '28');
  await fireEvent.changeText(screen.getByLabelText("Furthest you'll travel (km)"), '15');
  await fireEvent.press(chip('Save work preferences'));

  await waitFor(() => expect(PUT).toHaveBeenCalledTimes(2));
  const sent = Object.fromEntries(PUT.mock.calls.map(([, o]) => [o.params.path.kind, o.body]));
  expect(sent.permanent).toMatchObject({
    min_hourly_pay: '40.00',
    notice_period_days: 28,
    max_travel_km: null,
  });
  expect(sent.temporary).toMatchObject({
    min_hourly_pay: '30.00',
    max_travel_km: 15,
    notice_period_days: null,
  });
  expect(await screen.findByText(/Saved to your NUA CREW account/)).toBeTruthy();
});

it('keeps typed values and sends nothing when a field is invalid', async () => {
  serve({ permanent: pref('permanent'), temporary: null });
  await renderApp(<WorkPreferences />);
  const notice = await screen.findByLabelText('Notice period (days)');
  await fireEvent.changeText(notice, '999');
  await fireEvent.changeText(screen.getByLabelText("Lowest hourly pay you'd consider"), '35');
  await fireEvent.press(chip('Save work preferences'));
  expect(await screen.findByText('Enter whole days from 0 to 365')).toBeTruthy();
  expect(screen.getByText(/Nothing was saved/)).toBeTruthy();
  expect(PUT).not.toHaveBeenCalled();
  expect(screen.getByLabelText('Notice period (days)').props.value).toBe('999');
  expect(screen.getByLabelText("Lowest hourly pay you'd consider").props.value).toBe('35');
});

it('keeps typed values when the server fails and lets the person retry', async () => {
  serve({ permanent: pref('permanent'), temporary: null });
  PUT.mockResolvedValueOnce(fail(503, 'Service unavailable'));
  await renderApp(<WorkPreferences />);
  const pay = await screen.findByLabelText("Lowest hourly pay you'd consider");
  await fireEvent.changeText(pay, '35');
  await fireEvent.press(chip('Save work preferences'));
  expect(await screen.findByText(/Your answers are still here/)).toBeTruthy();
  expect(screen.getByLabelText("Lowest hourly pay you'd consider").props.value).toBe('35');
  await fireEvent.press(chip('Save work preferences'));
  await waitFor(() => expect(PUT).toHaveBeenCalledTimes(2));
});

it('switching a kind off keeps its answers and says so', async () => {
  serve({
    permanent: pref('permanent', { notice_period_days: 28, discoverable: true }),
    temporary: pref('temporary', { max_travel_km: 15 }),
  });
  await renderApp(<WorkPreferences />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Temporary' }));
  expect(screen.queryByText('Permanent work')).toBeNull();
  expect(screen.getByText(/Permanent work is off. Your saved answers are kept/)).toBeTruthy();
  await fireEvent.press(chip('Save work preferences'));
  await waitFor(() => expect(PUT).toHaveBeenCalledTimes(2));
  const perm = PUT.mock.calls.find(([, o]) => o.params.path.kind === 'permanent')![1].body;
  expect(perm).toMatchObject({ enabled: false, notice_period_days: 28 });
});

it('discovery is off until the person chooses, and explains what employers see', async () => {
  serve({ permanent: null, temporary: pref('temporary') });
  PUT.mockImplementation(async (path: string) =>
    path === '/v1/candidate/consents/discovery/{kind}'
      ? ok(pref('temporary', { discoverable: true }))
      : ok(profile(true)),
  );
  await renderApp(<WorkPreferences />);
  expect(await screen.findByText(/Off. Nobody can find you/)).toBeTruthy();
  expect(screen.getByText(/Never your pay floor or calendar/)).toBeTruthy();
  await fireEvent.press(chip('Let verified employers find me'));
  await waitFor(() =>
    expect(PUT).toHaveBeenCalledWith('/v1/candidate/consents/discovery/{kind}', {
      params: { path: { kind: 'temporary' } },
      body: { granted: true },
    }),
  );
  // the master switch was off, so granting turned it on first with the person's explicit tap
  expect(PUT).toHaveBeenCalledWith('/v1/candidate/consents/talent-discovery', {
    body: { granted: true },
  });
});

it('an unsaved kind cannot be made discoverable yet', async () => {
  serve({ permanent: null, temporary: null });
  await renderApp(<WorkPreferences />);
  await fireEvent.press(await screen.findByRole('button', { name: 'Permanent' }));
  expect(screen.getByText(/Save your permanent answers first/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Let verified employers find me' })).toBeNull();
});

it('every control has an accessible role and label', async () => {
  serve({ permanent: pref('permanent'), temporary: pref('temporary') });
  await renderApp(<WorkPreferences />);
  await screen.findByText('Permanent work');
  for (const label of [
    'Fewest hours a week',
    'Most hours a week',
    'Notice period (days)',
    'Available to start from',
    "Furthest you'll travel (km)",
  ])
    expect(screen.getAllByLabelText(label).length).toBeGreaterThan(0);
  const header = screen.getAllByRole('header');
  expect(header.length).toBeGreaterThan(2);
  expect(
    within(screen.getByText('Permanent work').parent!.parent!).getAllByRole('button').length,
  ).toBeGreaterThan(3);
});
