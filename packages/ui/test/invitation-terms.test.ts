import {
  changedTerms,
  payText,
  termsLines,
  type InvitationTermsLike,
} from '../src/invitation-terms';

const terms = (over: Partial<InvitationTermsLike> = {}): InvitationTermsLike => ({
  business: 'Fictional Cafe',
  title: 'Barista',
  suburb: 'Fitzroy',
  state: 'VIC',
  pay_min: '30.00',
  pay_max: '34.00',
  pay_period: 'hour',
  pay_basis: 'disclosed',
  super_included: false,
  ...over,
});

describe('payText', () => {
  it('shows disclosed pay with its period and super', () => {
    expect(payText(terms())).toBe('$30–$34 per hour, plus super');
    expect(payText(terms({ pay_max: '30.00', super_included: true }))).toBe(
      '$30 per hour, super included',
    );
    expect(payText(terms({ super_included: null }))).toBe('$30–$34 per hour');
  });

  it('never invents pay that was not disclosed', () => {
    expect(payText(terms({ pay_basis: 'not_disclosed' }))).toBe('Pay not disclosed');
    expect(payText(terms({ pay_min: null, pay_max: null }))).toBe('Pay not disclosed');
  });
});

describe('termsLines', () => {
  it('states what is missing instead of leaving it blank', () => {
    expect(termsLines(terms({ suburb: null, state: null }))).toEqual([
      'Barista at Fictional Cafe',
      'Location not stated',
      'Hours not stated',
      'Dates not stated',
      '$30–$34 per hour, plus super',
    ]);
  });

  it('shows hours and dates when given', () => {
    const lines = termsLines(
      terms({ min_weekly_hours: '10', max_weekly_hours: '20', start_date: '2027-01-04' }),
    );
    expect(lines).toContain('10–20 hours a week');
    expect(lines).toContain('2027-01-04 to open');
  });
});

describe('changedTerms', () => {
  it('is empty when nothing changed', () => {
    expect(changedTerms(terms(), terms())).toEqual([]);
  });

  it('names each change with before and after, and ignores what did not change', () => {
    const now = terms({ pay_min: '28.00', pay_max: '30.00', suburb: 'Collingwood' });
    expect(changedTerms(terms(), now)).toEqual([
      'Pay: was $30–$34 per hour, plus super, now $28–$30 per hour, plus super',
      'Location: was Fitzroy, VIC, now Collingwood, VIC',
    ]);
  });

  it('flags pay being withdrawn from view', () => {
    expect(changedTerms(terms(), terms({ pay_basis: 'not_disclosed' }))).toEqual([
      'Pay: was $30–$34 per hour, plus super, now Pay not disclosed',
    ]);
  });
});
