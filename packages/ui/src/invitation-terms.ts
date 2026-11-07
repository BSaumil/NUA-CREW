/**
 * Plain-language lines for what a person is invited to, and what changed since the invitation
 * was sent. Structural types, so any client can pass the API's `InvitationTerms` straight in.
 */
export type InvitationTermsLike = {
  business: string;
  title: string;
  suburb?: string | null;
  state?: string | null;
  min_weekly_hours?: string | null;
  max_weekly_hours?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  pay_min?: string | null;
  pay_max?: string | null;
  pay_period?: string | null;
  pay_basis: string;
  super_included?: boolean | null;
};

const money = (v: string) => `$${v.replace(/\.00$/, '')}`;

/** "Pay not disclosed" is stated, never guessed: only disclosed numbers are shown. */
export function payText(t: InvitationTermsLike): string {
  if (t.pay_basis === 'not_disclosed' || (t.pay_min == null && t.pay_max == null))
    return 'Pay not disclosed';
  const lo = t.pay_min ?? t.pay_max!;
  const hi = t.pay_max ?? t.pay_min!;
  const range = lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`;
  const period = t.pay_period ? ` per ${t.pay_period}` : '';
  const sup =
    t.super_included == null ? '' : t.super_included ? ', super included' : ', plus super';
  return `${range}${period}${sup}`;
}

export const whereText = (t: InvitationTermsLike) =>
  [t.suburb, t.state].filter(Boolean).join(', ') || 'Location not stated';

export const hoursText = (t: InvitationTermsLike) =>
  t.min_weekly_hours || t.max_weekly_hours
    ? `${t.min_weekly_hours ?? '?'}–${t.max_weekly_hours ?? '?'} hours a week`
    : 'Hours not stated';

export const datesText = (t: InvitationTermsLike) =>
  t.start_date || t.end_date
    ? `${t.start_date ?? 'open'} to ${t.end_date ?? 'open'}`
    : 'Dates not stated';

export const termsLines = (t: InvitationTermsLike): string[] => [
  `${t.title} at ${t.business}`,
  whereText(t),
  hoursText(t),
  datesText(t),
  payText(t),
];

/** One line per thing that differs between the terms invited and the terms now. Empty = same. */
export function changedTerms(invited: InvitationTermsLike, now: InvitationTermsLike): string[] {
  const rows: [string, string, string][] = [
    ['Pay', payText(invited), payText(now)],
    ['Location', whereText(invited), whereText(now)],
    ['Hours', hoursText(invited), hoursText(now)],
    ['Dates', datesText(invited), datesText(now)],
    ['Role', invited.title, now.title],
  ];
  return rows.filter(([, a, b]) => a !== b).map(([k, a, b]) => `${k}: was ${a}, now ${b}`);
}
