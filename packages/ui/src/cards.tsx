import { getMarket } from '@nua-crew/markets';
import { SalaryDisclosure, TrustIndicator, type PayBasis, type VerificationStatus } from './trust';

export type JobCardJob = {
  promoted?: boolean;
  id: string;
  title: string;
  employerName: string | null;
  verification: VerificationStatus;
  attribution?: string | null;
  suburb?: string | null;
  state?: string | null;
  employmentType: string;
  payMin?: string | null;
  payMax?: string | null;
  payPeriod?: string | null;
  payBasis: PayBasis;
  superIncluded?: boolean | null;
  publishedAt?: string | null;
  roleTitle?: string | null;
  /** ISO currency of the pay. Absent on legacy records, which the API defines as AUD. */
  currency?: string | null;
  /** Only set when the record's country is verified. Never guessed from the suburb or state. */
  verifiedCountry?: string | null;
};

const TYPE_LABEL: Record<string, string> = {
  full_time: 'Full time',
  part_time: 'Part time',
  casual: 'Casual',
  contract: 'Contract',
  shift: 'Shift',
};
export const employmentTypeLabel = (t: string) => TYPE_LABEL[t] ?? t;

export function JobCard({
  job,
  href,
  headingLevel = 2,
  showCurrencyCode = false,
}: {
  job: JobCardJob;
  href: string;
  headingLevel?: 2 | 3;
  /** Set when results may span countries so every amount carries its ISO currency. */
  showCurrencyCode?: boolean;
}) {
  const country = getMarket(job.verifiedCountry);
  const Heading = `h${headingLevel}` as const;
  return (
    <article className="nua-card nua-stack" aria-labelledby={`job-${job.id}`}>
      <div>
        {job.promoted ? <span className="nua-badge">Promoted</span> : null}
        <Heading id={`job-${job.id}`} style={{ marginBottom: 4, fontSize: '1.125rem' }}>
          <a href={href}>{job.title}</a>
        </Heading>
        <div className="nua-muted">{job.employerName ?? 'Employer not named'}</div>
        {job.roleTitle ? <div className="nua-hint">{job.roleTitle}</div> : null}
      </div>
      <div className="nua-row">
        <TrustIndicator status={job.verification} source={job.attribution} />
      </div>
      <div className="nua-row nua-muted">
        {job.suburb ? (
          <span>
            {job.suburb}
            {job.state ? `, ${job.state}` : ''}
          </span>
        ) : null}
        <span>{employmentTypeLabel(job.employmentType)}</span>
        {country ? <span className="nua-badge">{country.label}</span> : null}
      </div>
      <SalaryDisclosure
        min={job.payMin}
        max={job.payMax}
        period={job.payPeriod}
        currency={job.currency ?? 'AUD'}
        showCurrencyCode={showCurrencyCode}
        basis={job.payBasis}
        superIncluded={job.superIncluded}
      />
    </article>
  );
}

export function ShiftCard({
  title,
  venue,
  start,
  end,
  payPerHour,
  status,
}: {
  title: string;
  venue: string;
  start: string;
  end: string;
  payPerHour?: string | null;
  status: 'open' | 'offered' | 'confirmed' | 'filled' | 'cancelled';
}) {
  const fmt = (iso: string) =>
    new Intl.DateTimeFormat('en-AU', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'Australia/Melbourne',
    }).format(new Date(iso));
  return (
    <article className="nua-card nua-stack">
      <p style={{ marginBottom: 0, fontWeight: 700 }}>{title}</p>
      <div className="nua-muted">{venue}</div>
      <div>
        <time dateTime={start}>{fmt(start)}</time> – <time dateTime={end}>{fmt(end)}</time>
      </div>
      <div className="nua-row">
        <span className={`nua-badge ${status === 'open' ? 'nua-badge--live' : ''}`}>{status}</span>
        {payPerHour ? (
          <strong>${payPerHour} / hour</strong>
        ) : (
          <span className="nua-badge">Pay not disclosed</span>
        )}
      </div>
    </article>
  );
}

const STATUS_COPY: Record<string, { label: string; tone: string }> = {
  submitted: { label: 'Submitted', tone: '' },
  under_review: { label: 'Under review', tone: 'nua-badge--live' },
  shortlisted: { label: 'Shortlisted', tone: 'nua-badge--live' },
  interview: { label: 'Interview', tone: 'nua-badge--live' },
  offer: { label: 'Offer', tone: 'nua-badge--ok' },
  hired: { label: 'Hired', tone: 'nua-badge--ok' },
  rejected: { label: 'Not progressed', tone: 'nua-badge--warn' },
  withdrawn: { label: 'Withdrawn', tone: '' },
};

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_COPY[status] ?? { label: status, tone: '' };
  return <span className={`nua-badge ${s.tone}`.trim()}>{s.label}</span>;
}
