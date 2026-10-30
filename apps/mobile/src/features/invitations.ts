import type { Schemas } from '@nua-crew/contracts';
import { payRange } from './format';

export type Terms = Schemas['InvitationTerms'];

const pay = (t: Terms) =>
  payRange({
    pay_min: t.pay_min ?? null,
    pay_max: t.pay_max ?? null,
    pay_period: t.pay_period ?? null,
    pay_currency: 'AUD',
  } as never) ?? 'Pay not disclosed';

const where = (t: Terms) => [t.suburb, t.state].filter(Boolean).join(', ') || 'Location not stated';

const hours = (t: Terms) =>
  t.min_weekly_hours || t.max_weekly_hours
    ? `${t.min_weekly_hours ?? '?'}–${t.max_weekly_hours ?? '?'} hours a week`
    : 'Hours not stated';

const dates = (t: Terms) =>
  t.start_date || t.end_date
    ? `${t.start_date ?? 'open'} to ${t.end_date ?? 'open'}`
    : 'Dates not stated';

/** Human lines for what changed between the terms invited and the terms now. Empty = identical. */
export function changedTerms(invited: Terms, now: Terms): string[] {
  const rows: [string, string, string][] = [
    ['Pay', pay(invited), pay(now)],
    ['Location', where(invited), where(now)],
    ['Hours', hours(invited), hours(now)],
    ['Dates', dates(invited), dates(now)],
    ['Role', invited.title, now.title],
    ['Super', String(invited.super_included), String(now.super_included)],
    ['Pay basis', invited.pay_basis, now.pay_basis],
  ];
  return rows.filter(([, a, b]) => a !== b).map(([k, a, b]) => `${k}: was ${a}, now ${b}`);
}

export const KIND_LABEL = { permanent: 'Permanent', temporary: 'Temporary' } as const;

export const STATUS_LABEL: Record<
  string,
  { label: string; tone: 'neutral' | 'live' | 'ok' | 'warn' }
> = {
  pending: { label: 'Waiting for you', tone: 'live' },
  accepted: { label: 'Accepted', tone: 'ok' },
  declined: { label: 'Declined', tone: 'neutral' },
  withdrawn: { label: 'Withdrawn by employer', tone: 'neutral' },
  expired: { label: 'Expired', tone: 'warn' },
};

export function expiryText(iso: string, status: string, now = Date.now()): string {
  const when = new Date(iso);
  const day = when.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' });
  if (status !== 'pending') return status === 'expired' ? `Expired ${day}` : '';
  const days = Math.ceil((when.getTime() - now) / 86_400_000);
  return days <= 1 ? `Closes ${day} (within a day)` : `Open until ${day}`;
}

export const termsLines = (t: Terms): string[] => [
  `${t.title} at ${t.business}`,
  where(t),
  hours(t),
  dates(t),
  pay(t),
];
