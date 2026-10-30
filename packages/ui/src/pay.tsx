export type PayCheckLevel = 'info' | 'warn' | 'block';
export type PayVerdictData = {
  status: 'compliant_as_assessed' | 'below_minimum' | 'requires_review' | 'missing_source';
  summary: string;
  instrument: string;
  classification_label?: string | null;
  employment: string;
  offered_hourly_minor?: number | null;
  minimum_ordinary_hourly_minor?: number | null;
  weekend_and_holiday_minimums?: Record<string, number | null>;
  checks: { code: string; level: PayCheckLevel; text: string }[];
  not_assessed: string[];
  data_status: string;
  super?: { rate_bp: number; per_hour_minor?: number | null } | null;
};

export const dollars = (minor: number | null | undefined) =>
  minor == null
    ? '—'
    : new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD' }).format(minor / 100);

const LOOK = {
  compliant_as_assessed: {
    cls: 'nua-verdict--ok',
    icon: '✓',
    title: 'Meets the minimum as assessed',
  },
  below_minimum: { cls: 'nua-verdict--block', icon: '✕', title: 'Below the award minimum' },
  requires_review: { cls: 'nua-verdict--warn', icon: '!', title: 'Needs your review' },
  missing_source: { cls: 'nua-verdict--warn', icon: '!', title: "Can't be checked yet" },
} as const;

const DAY = {
  saturday: 'Saturday',
  sunday: 'Sunday',
  public_holiday: 'Public holiday',
} as const;

/** The employer-facing result of a pay check. Never says "compliant" without "as assessed". */
export function PayVerdict({ result }: { result: PayVerdictData }) {
  const look = LOOK[result.status];
  const blocks = result.checks.filter((c) => c.level !== 'info');
  // Stored as JSONB, whose key order is not the order we want people to read.
  const others = (['saturday', 'sunday', 'public_holiday'] as const)
    .filter((k) => result.weekend_and_holiday_minimums && k in result.weekend_and_holiday_minimums)
    .map((k) => [k, result.weekend_and_holiday_minimums?.[k] ?? null] as const);
  return (
    <section className={`nua-verdict ${look.cls}`} aria-labelledby="pay-verdict">
      <div className="nua-verdict__head">
        <span className="nua-verdict__icon" aria-hidden="true">
          {look.icon}
        </span>
        <span id="pay-verdict">{look.title}</span>
      </div>
      <p style={{ margin: 0 }}>{result.summary}</p>
      {result.minimum_ordinary_hourly_minor != null ? (
        <dl className="nua-ratebar" style={{ margin: 0 }}>
          <div>
            <dt>Your rate</dt>
            <dd className="nua-money">{dollars(result.offered_hourly_minor)}</dd>
          </div>
          <div>
            <dt>{result.employment === 'casual' ? 'Casual weekday minimum' : 'Weekday minimum'}</dt>
            <dd className="nua-money">{dollars(result.minimum_ordinary_hourly_minor)}</dd>
          </div>
          {others.map(([k, v]) => (
            <div key={k}>
              <dt>{DAY[k as keyof typeof DAY] ?? k} minimum</dt>
              <dd className="nua-money">{v == null ? 'Not loaded' : dollars(v)}</dd>
            </div>
          ))}
          {result.super?.per_hour_minor != null ? (
            <div>
              <dt>Super on top (12%)</dt>
              <dd className="nua-money">{dollars(result.super.per_hour_minor)}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      {blocks.length ? (
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          {blocks.map((c) => (
            <li key={c.code}>{c.text}</li>
          ))}
        </ul>
      ) : null}
      <details>
        <summary>What this check does not cover</summary>
        <ul>
          {result.not_assessed.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </details>
      <p className="nua-hint" style={{ margin: 0, color: 'inherit' }}>
        {result.data_status === 'verified'
          ? 'Rates verified against the Fair Work pay guide.'
          : 'Reference rates from the supplied 2026–27 edition, awaiting verification.'}{' '}
        {result.instrument.startsWith('MA') ? `Award ${result.instrument}.` : ''}
      </p>
    </section>
  );
}
