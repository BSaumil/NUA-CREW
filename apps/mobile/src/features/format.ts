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
  const options: Intl.NumberFormatOptions = {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  };
  // A$ and NZ$ remain explicit when comparing future jobs across markets.
  if (currency === 'NZD') return `NZ$${new Intl.NumberFormat('en-NZ', options).format(n)}`;
  return new Intl.NumberFormat('en-AU', {
    ...options,
    style: 'currency',
    currency,
  }).format(n);
};

/** "$28â€“$32 / hour" â€” null when the employer disclosed nothing. */
export function payRange(
  j: Pick<Job, 'pay_min' | 'pay_max' | 'pay_period' | 'pay_currency'>,
): string | null {
  const { pay_min: lo, pay_max: hi } = j;
  if (lo == null && hi == null) return null;
  const range =
    lo != null && hi != null && String(lo) !== String(hi)
      ? `${money(lo, j.pay_currency)}â€“${money(hi, j.pay_currency)}`
      : money((lo ?? hi) as string, j.pay_currency);
  return `${range} / ${PAY_PERIOD_LABEL[j.pay_period ?? ''] ?? j.pay_period}`;
}

export const superText = (v: boolean | null | undefined) =>
  v == null ? 'super not stated' : v ? 'incl. super' : 'plus super';

export type PayLabel = 'Disclosed' | 'Estimated' | null;
export const payLabel = (b¶»§q«^