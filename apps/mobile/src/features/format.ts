import type { Schemas } from '@nua-crew/contracts';

export type Job = Schemas['JobOut'];

export const PAY_PERIOD_LABEL: Record<string, string> = {
  hour: 'hour',
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
};

const money = (v: string | number, currency = 'AUD') => {
  const n = Number(v);
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
};

/** "$28–$32 / hour" — null when the employer disclosed nothing. */
export function payRange(
  j: Pick<Job, 'pay_min' | 'pay_max' | 'pay_period' | 'pay_currency'>,
): string | null {
  const { pay_min: lo, pay_max: hi } = j;
  if (lo == null && hi == null) return null;
  const range =
    lo != null && hi != null && String(lo) !== String(hi)
      ? `${money(lo, j.pay_currency)}–${money(hi, j.pay_currency)}`
      : money((lo ?? hi) as string, j.pay_currency);
  return `${range} / ${PAY_PERIOD_LABEL[j.pay_period ?? ''] ?? j.pay_period}`;
}

export const superText = (v: boolean | null | undefined) =>
  v == null ? 'super not stated' : v ? 'incl. super' : 'plus super';

export type PayLabel = 'Disclosed' | 'Estimated' | null;
export const payLabel = (basis: string): PayLabel =>
  basis === 'estimated' ? 'Estimated' : basis === 'disclosed' ? 'Disclosed' : null;

export function postedAgo(iso: string | null | undefined, now = Date.now()): string | null {
  if (!iso) return null;
  const days = Math.floor((now - new Date(iso).getTime()) / 86_400_000);
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  return `${Math.floor(days / 30)} mo ago`;
}

/** A listing nobody has re-confirmed recently deserves a warning (never silently shown as fresh). */
export function isStale(
  lastVerifiedAt: string | null | undefined,
  now = Date.now(),
  days = 14,
): boolean {
  if (!lastVerifiedAt) return false;
  return now - new Date(lastVerifiedAt).getTime() > days * 86_400_000;
}

export function distanceLabel(km: number | null | undefined): string | null {
  if (km == null) return null;
  return km < 1 ? '< 1 km away' : `${km.toFixed(km < 10 ? 1 : 0)} km away`;
}

/** Straightforward completeness score for the profile screen (not AI, not a ranking signal). */
export function profileStrength(
  p: {
    headline?: string | null;
    summary?: string | null;
    suburb?: string | null;
    skills?: string[];
    preferred_employment_types?: string[];
    min_hourly_pay?: string | null;
  },
  resumeCount: number,
): { percent: number; next: string | null } {
  const checks: [boolean, string][] = [
    [!!p.headline, 'Add a headline'],
    [!!p.suburb, 'Add your suburb'],
    [(p.skills?.length ?? 0) >= 3, 'Add at least 3 skills'],
    [(p.preferred_employment_types?.length ?? 0) > 0, 'Choose the work you are open to'],
    [!!p.summary, 'Write a short summary'],
    [resumeCount > 0, 'Add a resume'],
    [!!p.min_hourly_pay, 'Set a minimum hourly pay (private)'],
  ];
  const done = checks.filter(([ok]) => ok).length;
  return {
    percent: Math.round((done / checks.length) * 100),
    next: checks.find(([ok]) => !ok)?.[1] ?? null,
  };
}
