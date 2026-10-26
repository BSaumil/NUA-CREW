import { useId, type ReactNode } from 'react';

export type VerificationStatus = 'verified' | 'pending' | 'unverified' | 'rejected' | null;

export function TrustIndicator({
  status,
  evidence,
  source,
}: {
  status: VerificationStatus;
  evidence?: string;
  source?: string | null;
}) {
  if (status === 'verified') {
    return (
      <span className="nua-badge nua-badge--ok" title={evidence}>
        <span aria-hidden="true">✓</span> Verified business
        <span className="nua-hint" style={{ margin: 0 }}>
          {' '}
          (identity checked, not an endorsement)
        </span>
      </span>
    );
  }
  if (status === null) {
    return (
      <span className="nua-badge">
        Listed via {source ?? 'a licensed source'}
        <span className="nua-hint" style={{ margin: 0 }}>
          {' '}
          — employer not verified by NUA CREW
        </span>
      </span>
    );
  }
  if (status === 'pending')
    return <span className="nua-badge nua-badge--warn">Verification in review</span>;
  return <span className="nua-badge nua-badge--warn">Not yet verified</span>;
}

export type PayBasis = 'disclosed' | 'estimated' | 'not_disclosed';

const PERIOD: Record<string, string> = {
  hour: 'hour',
  day: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
};

function money(v: string | number, currency: string) {
  const n = Number(v);
  const f = new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency,
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return f.format(n);
}

export function SalaryDisclosure({
  min,
  max,
  period,
  currency = 'AUD',
  basis,
  superIncluded,
}: {
  min?: string | number | null;
  max?: string | number | null;
  period?: string | null;
  currency?: string;
  basis: PayBasis;
  superIncluded?: boolean | null;
}) {
  if (basis === 'not_disclosed' || (min == null && max == null)) {
    return <span className="nua-badge">Pay not disclosed</span>;
  }
  const range =
    min != null && max != null && String(min) !== String(max)
      ? `${money(min, currency)}–${money(max, currency)}`
      : money((min ?? max) as string | number, currency);
  const superText =
    superIncluded == null
      ? 'super treatment not stated'
      : superIncluded
        ? 'incl. super'
        : 'plus super';
  return (
    <span>
      <strong>
        {range} / {PERIOD[period ?? ''] ?? period}
      </strong>{' '}
      <span className="nua-muted">({superText})</span>{' '}
      <span className={`nua-badge ${basis === 'estimated' ? 'nua-badge--warn' : 'nua-badge--ok'}`}>
        {basis === 'estimated' ? 'Estimated' : 'Disclosed'}
      </span>
    </span>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const id = useId();
  return (
    <section className="nua-empty" aria-labelledby={id}>
      <h2 id={id}>{title}</h2>
      {description ? <p className="nua-muted">{description}</p> : null}
      {action}
    </section>
  );
}
