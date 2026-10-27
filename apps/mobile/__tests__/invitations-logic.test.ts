import { changedTerms, expiryText, termsLines } from '../src/features/invitations';
import { routeFor } from '../src/features/links';

const terms = (over = {}) => ({
  business: 'Fitzroy Cafe',
  job_id: 'j1',
  title: 'Barista',
  suburb: 'Fitzroy',
  state: 'VIC',
  employment_type: 'casual',
  engagement_basis: 'employee',
  duration_type: 'unspecified',
  hours_pattern: 'casual',
  min_weekly_hours: '10',
  max_weekly_hours: '20',
  start_date: null,
  end_date: null,
  pay_min: '28.00',
  pay_max: '32.00',
  pay_period: 'hour',
  pay_basis: 'disclosed',
  super_included: false,
  ...over,
});

describe('changedTerms', () => {
  it('is empty when nothing material changed', () => {
    expect(changedTerms(terms(), terms())).toEqual([]);
  });
  it('names each material change in plain words', () => {
    const d = changedTerms(
      terms(),
      terms({ pay_max: '36.00', suburb: 'Richmond', max_weekly_hours: '30' }),
    );
    expect(d).toHaveLength(3);
    expect(d.join(' ')).toMatch(/Pay: was .*32.*now .*36/);
    expect(d.join(' ')).toMatch(/Location: was Fitzroy, VIC, now Richmond, VIC/);
    expect(d.join(' ')).toMatch(/Hours: was 10–20 hours a week, now 10–30/);
  });
  it('says so when pay becomes undisclosed rather than hiding it', () => {
    const d = changedTerms(
      terms(),
      terms({ pay_min: null, pay_max: null, pay_period: null, pay_basis: 'not_disclosed' }),
    );
    expect(d.join(' ')).toMatch(/now Pay not disclosed/);
  });
});

describe('expiryText', () => {
  const now = Date.parse('2026-11-01T00:00:00Z');
  it('describes open, closing-soon, expired and answered invitations', () => {
    expect(expiryText('2026-11-05T00:00:00Z', 'pending', now)).toMatch(/^Open until/);
    expect(expiryText('2026-11-01T10:00:00Z', 'pending', now)).toMatch(/within a day/);
    expect(expiryText('2026-10-30T00:00:00Z', 'expired', now)).toMatch(/^Expired/);
    expect(expiryText('2026-11-05T00:00:00Z', 'accepted', now)).toBe('');
  });
});

it('summarises the role in lines the screen reader can read', () => {
  expect(termsLines(terms())[0]).toBe('Barista at Fitzroy Cafe');
});

describe('notification routing', () => {
  it('opens invitations and conversations by id', () => {
    expect(routeFor('invitation_received', { invitation_id: 'i1' })).toEqual({
      pathname: '/invitation/[id]',
      params: { id: 'i1' },
    });
    expect(routeFor('message_received', { conversation_id: 'c1' })).toEqual({
      pathname: '/conversation/[id]',
      params: { id: 'c1' },
    });
  });
  it('falls back to alerts when the payload has no usable id', () => {
    expect(routeFor('invitation_received', {})).toBe('/(app)/alerts');
    expect(routeFor('message_received', { conversation_id: 7 })).toBe('/(app)/alerts');
  });
});
