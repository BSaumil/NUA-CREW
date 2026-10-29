import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { api } from '../src/api/client';
import { PayCheckPanel, emptyCheck, checkKey, type CheckState } from '../src/ui/pay-check-panel';
import type { PayAssessmentOut } from '../src/api/pay';
import { ok, renderApp } from './helpers';

jest.mock('../src/api/client', () => ({
  ...jest.requireActual('../src/api/client'),
  api: { GET: jest.fn(), POST: jest.fn() },
}));
jest.mock('../src/state/HireWorkspace', () => ({
  useHireWorkspace: () => ({ employerId: 'e1', role: 'owner', pending: false, error: null }),
}));
const GET = api.GET as unknown as jest.Mock;
const POST = api.POST as unknown as jest.Mock;

const awards = [
  {
    code: 'MA000119',
    title: 'Restaurant Industry Award 2020',
    source_url: 'https://awards.fairwork.gov.au/MA000119.html',
    classifications: [
      {
        code: 'L2',
        label: 'Level 2',
        description: 'Cook grade 1; F&B grade 2',
        kind: 'operative',
        hourly_minor: 2708,
      },
      {
        code: 'L3',
        label: 'Level 3',
        description: 'F&B grade 3',
        kind: 'operative',
        hourly_minor: 2797,
      },
    ],
  },
];
const verdict = (status: string, extra = {}) => ({
  id: 'a1',
  result: {
    status,
    summary: status === 'below_minimum' ? 'The offered rate is below the award minimum.' : 'Meets.',
    instrument: 'MA000119',
    employment: 'casual',
    offered_hourly_minor: 2500,
    minimum_ordinary_hourly_minor: 3385,
    weekend_and_holiday_minimums: { saturday: 4062, sunday: 4062, public_holiday: 6770 },
    checks: [{ code: 'x', level: 'block', text: 'Below the casual ordinary minimum for Level 2.' }],
    not_assessed: ['Overtime and ordinary-hours limits'],
    data_status: 'supplied_unverified',
    needs_acknowledgement: status === 'requires_review',
    super: { rate_bp: 1200, per_hour_minor: 300 },
    ...extra,
  },
});

function Harness({ onResult }: { onResult?: (a: PayAssessmentOut) => void }) {
  const [check, setCheck] = useState<CheckState>(emptyCheck);
  const [rate, setRate] = useState('25.00');
  const [max, setMax] = useState('');
  const [a, setA] = useState<PayAssessmentOut | null>(null);
  const [key, setKey] = useState('');
  const [ack, setAck] = useState(false);
  return (
    <PayCheckPanel
      roleCode="HC-0060"
      state="VIC"
      jobType="casual"
      rate={rate}
      onRate={setRate}
      max={max}
      onMax={setMax}
      value={check}
      onChange={setCheck}
      assessment={a}
      onAssessment={(out, k) => {
        setA(out);
        setKey(k);
        setAck(false);
        onResult?.(out);
      }}
      stale={!!a && key !== checkKey(check, rate, 'casual')}
      acknowledged={ack}
      onAcknowledge={setAck}
    />
  );
}

beforeEach(() => {
  GET.mockReset();
  POST.mockReset();
  GET.mockImplementation(async (path: string) => {
    if (path === '/v1/awards') return ok(awards);
    if (path === '/v1/awards/coverage-guidance')
      return ok({
        note: 'The supplied guide lists Levels 1 to 3 for this kind of role. A job title never decides the award or the classification.',
        suggestions: [{ instrument: 'MA000119', classification_leads: ['L2'] }],
        questions: [],
      });
    throw new Error(`unexpected GET ${path}`);
  });
});

it('guides the employer through award, classification and confirmations, then shows a blocking verdict', async () => {
  POST.mockResolvedValue(ok(verdict('below_minimum')));
  await renderApp(<Harness />);
  expect(await screen.findByText(/A job title never decides/)).toBeTruthy();
  const check = screen.getByRole('button', { name: 'Check this pay' });
  expect(check.props.accessibilityState?.disabled).toBe(true); // no award chosen yet

  await fireEvent.press(await screen.findByRole('button', { name: 'Restaurant · often used' }));
  await fireEvent.press(
    screen.getByRole('button', { name: /Level 2 · \$27\.08\/h · listed for this role/ }),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: 'This award covers my business and this work' }),
  );
  await fireEvent.press(
    screen.getByRole('button', { name: /I’ve matched this to the real duties/ }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Check this pay' }));

  await waitFor(() => expect(POST).toHaveBeenCalled());
  expect(POST.mock.calls[0]![1].body).toMatchObject({
    role_code: 'HC-0060',
    instrument: 'MA000119',
    classification: 'L2',
    coverage_confirmed: true,
    classification_confirmed: true,
    employment: 'casual',
    pay_amount: '25.00',
  });
  expect(await screen.findByText('✕ Below the award minimum')).toBeTruthy();
  expect(screen.getByText('$33.85')).toBeTruthy();
  expect(screen.getAllByText('$40.62')).toHaveLength(2); // Saturday and Sunday
  expect(screen.getByText(/awaiting verification/)).toBeTruthy();
});

it('marks the verdict stale as soon as the rate changes and never offers acknowledgement for a block', async () => {
  POST.mockResolvedValue(ok(verdict('requires_review')));
  await renderApp(<Harness />);
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Enterprise agreement / not sure' }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Check this pay' }));
  expect(await screen.findByText('! Needs your review')).toBeTruthy();
  const ack = screen.getByRole('button', { name: /I’ve reviewed the award coverage/ });
  await fireEvent.press(ack);
  expect(
    screen.getByRole('button', { name: /I’ve reviewed the award coverage/ }).props
      .accessibilityState.selected,
  ).toBe(true);
  await fireEvent.changeText(screen.getByLabelText('Hourly rate (AUD, before super)'), '40.00');
  expect(await screen.findByText(/changed after the last check/)).toBeTruthy();
  expect(screen.queryByText('! Needs your review')).toBeNull();
});

it('shows a plain message when the check cannot run', async () => {
  await renderApp(<Harness />);
  await fireEvent.press(
    await screen.findByRole('button', { name: 'Enterprise agreement / not sure' }),
  );
  await fireEvent.changeText(screen.getByLabelText('Hourly rate (AUD, before super)'), '');
  await fireEvent.press(screen.getByRole('button', { name: 'Check this pay' }));
  expect(await screen.findByText('Enter the hourly rate you plan to pay.')).toBeTruthy();
  expect(POST).not.toHaveBeenCalled();
});
