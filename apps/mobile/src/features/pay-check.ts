/** Pure helpers for the native hospitality pay check (kept free of React for testing). */
import type { Schemas } from '@nua-crew/contracts';

export type PayAssessmentIn = Schemas['PayAssessmentIn'];
export type PayResult = Schemas['PayAssessmentResult'];

export const AWARD_LABEL: Record<string, string> = {
  MA000119: 'Restaurant',
  MA000009: 'Hospitality (general)',
  MA000003: 'Fast food',
  MA000058: 'Registered clubs',
};

export const dollars = (minor: number | null | undefined) =>
  minor == null
    ? '—'
    : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(minor / 100);

/** NUA CREW job types map onto the three employment bases the awards use. */
export const employmentOf = (type: string): 'casual' | 'part_time' | 'full_time' | null =>
  type === 'casual' || type === 'shift'
    ? 'casual'
    : type === 'part_time' || type === 'full_time'
      ? type
      : null;

export type CheckForm = {
  state: string;
  roleCode: string;
  instrument: string;
  coverageConfirmed: boolean;
  classification: string | null;
  classificationConfirmed: boolean;
  jobType: string;
  hourlyRate: string;
};

export function buildAssessment(f: CheckForm): { body?: PayAssessmentIn; error?: string } {
  const employment = employmentOf(f.jobType);
  if (!employment)
    return {
      error: 'Contract work can’t be pay-checked here. Use casual, part time or full time.',
    };
  const rate = Number(f.hourlyRate);
  if (!f.hourlyRate.trim() || !Number.isFinite(rate) || rate <= 0)
    return { error: 'Enter the hourly rate you plan to pay.' };
  if (!/^(VIC|NSW|QLD|SA|WA|TAS|ACT|NT)$/.test(f.state))
    return { error: 'Choose a work location with a state first.' };
  return {
    body: {
      state: f.state as PayAssessmentIn['state'],
      role_code: f.roleCode,
      instrument: f.instrument as PayAssessmentIn['instrument'],
      coverage_confirmed: f.coverageConfirmed,
      classification: f.classification,
      classification_confirmed: f.classificationConfirmed,
      employment,
      worker_class: 'adult',
      pay_period: 'hour',
      pay_amount: rate.toFixed(2),
      pay_includes_super: false,
      rate_structure: 'base_plus_penalties',
      roster: [],
    },
  };
}

/** A saved draft may only carry a pay check that still describes its advertised pay. */
export function saveBlocker(
  result: PayResult | null,
  acknowledged: boolean,
  stale: boolean,
): string | null {
  if (!result) return 'Run the pay check for this role before saving.';
  if (stale) return 'The pay changed after the check. Check it again.';
  if (result.status === 'below_minimum')
    return 'The rate is below the award minimum. Raise it before saving.';
  if (result.needs_acknowledgement && !acknowledged)
    return 'Confirm that you have reviewed this pay before saving.';
  return null;
}

export const VERDICT_COPY: Record<
  PayResult['status'],
  { title: string; icon: string; tone: 'ok' | 'warn' | 'danger' }
> = {
  compliant_as_assessed: { title: 'Meets the minimum as assessed', icon: '✓', tone: 'ok' },
  below_minimum: { title: 'Below the award minimum', icon: '✕', tone: 'danger' },
  requires_review: { title: 'Needs your review', icon: '!', tone: 'warn' },
  missing_source: { title: 'Can’t be checked yet', icon: '!', tone: 'warn' },
};
