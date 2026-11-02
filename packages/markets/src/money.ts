/**
 * Money is an integer count of minor units with an explicit ISO 4217 currency. Amounts in
 * different currencies are never added or compared without an explicit conversion step, which
 * this package deliberately does not provide.
 */
export interface Money {
  minor: number;
  currency: string;
}

const CURRENCY = /^[A-Z]{3}$/;

function fractionDigits(currency: string): number | null {
  if (!CURRENCY.test(currency)) return null;
  try {
    return (
      new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions()
        .maximumFractionDigits ?? null
    );
  } catch {
    return null;
  }
}

export function money(minor: unknown, currency: unknown): Money | null {
  if (typeof currency !== 'string' || fractionDigits(currency) === null) return null;
  if (typeof minor !== 'number' || !Number.isSafeInteger(minor)) return null;
  return { minor, currency };
}

/** Parses "27", "27.5" or "23.95" exactly, without floating point. Extra decimals are rejected. */
export function parseDecimalMoney(value: unknown, currency: unknown): Money | null {
  if (typeof currency !== 'string') return null;
  const digits = fractionDigits(currency);
  if (digits === null) return null;
  let text: string;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || value < 0) return null;
    text = String(value);
  } else if (typeof value === 'string') {
    text = value.trim();
  } else {
    return null;
  }
  const match = /^(\d{1,12})(?:\.(\d+))?$/.exec(text);
  if (!match) return null;
  const whole = match[1] ?? '';
  const frac = match[2] ?? '';
  if (frac.length > digits) return null;
  const minor = Number(whole + frac.padEnd(digits, '0'));
  return money(minor, currency);
}

export type SumResult = { ok: true; total: Money } | { ok: false; reason: 'currency-mismatch' };

export function sumMoney(a: Money, b: Money): SumResult {
  if (a.currency !== b.currency) return { ok: false, reason: 'currency-mismatch' };
  const total = money(a.minor + b.minor, a.currency);
  return total ? { ok: true, total } : { ok: false, reason: 'currency-mismatch' };
}

/** -1, 0 or 1; `null` when the currencies differ, because an FX rate would be needed. */
export function compareMoney(a: Money, b: Money): -1 | 0 | 1 | null {
  if (a.currency !== b.currency) return null;
  return a.minor === b.minor ? 0 : a.minor < b.minor ? -1 : 1;
}

export function formatMoney(value: Money, opts: { locale: string; showCode?: boolean }): string {
  const digits = fractionDigits(value.currency) ?? 2;
  return new Intl.NumberFormat(opts.locale, {
    style: 'currency',
    currency: value.currency,
    currencyDisplay: opts.showCode ? 'code' : 'symbol',
  }).format(value.minor / 10 ** digits);
}

export type PayPeriod = 'hour' | 'day' | 'week' | 'month' | 'year';

/**
 * A pay range that always names its currency, so mixed-country lists are never ambiguous.
 * Returns `null` when neither bound is a valid amount.
 */
export function formatPayRange(input: {
  min?: unknown;
  max?: unknown;
  currency: unknown;
  period?: PayPeriod | string | null;
  locale: string;
}): string | null {
  const lo = parseDecimalMoney(input.min, input.currency);
  const hi = parseDecimalMoney(input.max, input.currency);
  if (!lo && !hi) return null;
  const fmt = (m: Money) => formatMoney(m, { locale: input.locale, showCode: true });
  const range =
    lo && hi
      ? lo.minor === hi.minor
        ? fmt(lo)
        : `${fmt(lo)} – ${fmt(hi)}`
      : fmt((lo ?? hi) as Money);
  return input.period ? `${range} per ${input.period}` : range;
}
