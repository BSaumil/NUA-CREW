import {
  buildAssessment,
  dollars,
  employmentOf,
  saveBlocker,
  type CheckForm,
  type PayResult,
} from '../src/features/pay-check';

const form = (over: Partial<CheckForm> = {}): CheckForm => ({
  state: 'VIC',
  roleCode: 'HC-0060',
  instrument: 'MA000119',
  coverageConfirmed: true,
  classification: 'L2',
  classificationConfirmed: true,
  jobType: 'casual',
  hourlyRate: '33.85',
  ...over,
});
const result = (over: Partial<PayResult> = {}) =>
  ({ status: 'compliant_as_assessed', needs_acknowledgement: false, ...over }) as PayResult;

describe('native pay check', () => {
  it('maps job types onto award employment bases without guessing contract work', () => {
    expect(employmentOf('shift')).toBe('casual');
    expect(employmentOf('casual')).toBe('casual');
    expect(employmentOf('part_time')).toBe('part_time');
    expect(employmentOf('full_time')).toBe('full_time');
    expect(employmentOf('contract')).toBeNull();
    expect(buildAssessment(form({ jobType: 'contract' })).error).toMatch(/Contract/);
  });

  it('builds an hourly, adult, super-exclusive assessment with the employer’s confirmations', () => {
    const { body } = buildAssessment(form({ hourlyRate: '34.5' }));
    expect(body).toMatchObject({
      state: 'VIC',
      role_code: 'HC-0060',
      instrument: 'MA000119',
      coverage_confirmed: true,
      classification: 'L2',
      classification_confirmed: true,
      employment: 'casual',
      worker_class: 'adult',
      pay_period: 'hour',
      pay_amount: '34.50',
      pay_includes_super: false,
    });
    expect(buildAssessment(form({ coverageConfirmed: false })).body?.coverage_confirmed).toBe(
      false,
    );
  });

  it('refuses incomplete input with a plain message', () => {
    expect(buildAssessment(form({ hourlyRate: '' })).error).toMatch(/hourly rate/);
    expect(buildAssessment(form({ hourlyRate: '-3' })).error).toMatch(/hourly rate/);
    expect(buildAssessment(form({ state: '' })).error).toMatch(/state/);
  });

  it('blocks saving until the check is current, not below minimum and any review is acknowledged', () => {
    expect(saveBlocker(null, false, false)).toMatch(/Run the pay check/);
    expect(saveBlocker(result(), false, true)).toMatch(/changed/);
    expect(saveBlocker(result({ status: 'below_minimum' }), true, false)).toMatch(
      /below the award/,
    );
    expect(
      saveBlocker(result({ status: 'requires_review', needs_acknowledgement: true }), false, false),
    ).toMatch(/reviewed/);
    expect(
      saveBlocker(result({ status: 'requires_review', needs_acknowledgement: true }), true, false),
    ).toBeNull();
    expect(saveBlocker(result(), false, false)).toBeNull();
  });

  it('formats money in AUD and never invents a missing amount', () => {
    expect(dollars(3385)).toBe('$33.85');
    expect(dollars(null)).toBe('—');
  });
});
