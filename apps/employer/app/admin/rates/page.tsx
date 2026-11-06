import type { Metadata } from 'next';
import { Button } from '@nua-crew/ui';
import { api, errorMessage, requireAdmin } from '@/lib/api';
import { day, dollars, percent } from '@/lib/award-format';
import { Flash, flashFrom } from '../../components';
import { revokePenalty, revokeRate, verifyPenalty, verifyRate } from '../actions';

export const metadata: Metadata = { title: 'Award rate verification' };

const DAY_KIND: Record<string, string> = {
  weekday: 'Weekday',
  saturday: 'Saturday',
  sunday: 'Sunday',
  public_holiday: 'Public holiday',
};

type Status = 'supplied_unverified' | 'verified';

function Filters({ instrument, status }: { instrument: string; status: string }) {
  return (
    <>
      <input type="hidden" name="instrument_filter" value={instrument} />
      <input type="hidden" name="status_filter" value={status} />
    </>
  );
}

export default async function RatesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const { error, notice, p } = await flashFrom(searchParams);
  const client = await api();
  const awards = await client.GET('/v1/awards');
  const names = new Map((awards.data ?? []).map((a) => [a.code, a.title]));
  const instrument = names.has(String(p.instrument)) ? String(p.instrument) : '';
  const status: '' | Status =
    p.status === 'verified' || p.status === 'supplied_unverified' ? p.status : '';
  const query = {
    ...(instrument ? { instrument: instrument as never } : {}),
    ...(status ? { data_status: status } : {}),
  };
  const [rates, rules, allRates, allRules] = await Promise.all([
    client.GET('/v1/admin/awards/rate-versions', { params: { query } }),
    client.GET('/v1/admin/awards/penalty-rules', { params: { query } }),
    client.GET('/v1/admin/awards/rate-versions'),
    client.GET('/v1/admin/awards/penalty-rules'),
  ]);
  const count = (rows: { data_status: string }[] | undefined) => ({
    total: rows?.length ?? 0,
    verified: rows?.filter((r) => r.data_status === 'verified').length ?? 0,
  });
  const rateCount = count(allRates.data);
  const ruleCount = count(allRules.data);

  return (
    <div className="nua-stack">
      <h1>Award rate verification</h1>
      <Flash error={error} notice={notice} />
      <p>
        Figures loaded from the supplied workbook are <strong>supplied, not verified</strong>. Mark
        one verified only after you have checked it against the official Fair Work pay guide in
        force from the date shown. Verification is a record of your check. It is not legal advice
        and it does not change the figure. NUA CREW never fills in or estimates a rate.
      </p>
      <p role="status">
        {rateCount.verified} of {rateCount.total} hourly rates and {ruleCount.verified} of{' '}
        {ruleCount.total} penalty rules verified.
      </p>

      <form method="get" role="search" aria-label="Filter rates" className="nua-card">
        <div className="nua-grid">
          <div className="nua-field">
            <label htmlFor="instrument">Award</label>
            <select id="instrument" name="instrument" defaultValue={instrument}>
              <option value="">All awards</option>
              {[...names].map(([code, name]) => (
                <option key={code} value={code}>
                  {code} · {name}
                </option>
              ))}
            </select>
          </div>
          <div className="nua-field">
            <label htmlFor="status">Status</label>
            <select id="status" name="status" defaultValue={status}>
              <option value="">Any status</option>
              <option value="supplied_unverified">Supplied, not verified</option>
              <option value="verified">Verified</option>
            </select>
          </div>
        </div>
        <p>
          <Button type="submit" variant="secondary">
            Apply filters
          </Button>
        </p>
      </form>

      <section className="nua-stack" aria-labelledby="rates-title">
        <h2 id="rates-title">Hourly rates</h2>
        {!rates.response.ok ? <Flash error={errorMessage(rates.error)} /> : null}
        {rates.data?.length === 0 ? <p>No rates match these filters.</p> : null}
        {rates.data?.map((r) => {
          const label = `${r.instrument} ${r.classification} from ${day(r.effective_from)}`;
          return (
            <article className="nua-card nua-stack" key={r.id} aria-label={label}>
              <h3>
                {r.instrument} · {r.classification}
              </h3>
              <p>
                <strong>{dollars(r.hourly_minor)} per hour</strong> ({dollars(r.weekly_minor)} per
                week) · in force from {day(r.effective_from)}
                {r.effective_to ? ` to ${day(r.effective_to)}` : ' (current)'}
              </p>
              <p className="nua-hint">
                Supplied source:{' '}
                <a href={r.source_url} target="_blank" rel="noopener noreferrer">
                  {new URL(r.source_url).hostname}
                </a>
                . {r.source_note}
              </p>
              {r.data_status === 'verified' ? (
                <>
                  <p>
                    <strong>Verified</strong>
                    {r.verified_at
                      ? ` on ${new Date(r.verified_at).toLocaleDateString('en-AU')}`
                      : ''}
                    .
                  </p>
                  <form action={revokeRate} className="nua-stack">
                    <input type="hidden" name="id" value={r.id} />
                    <Filters instrument={instrument} status={status} />
                    <label htmlFor={`rr-${r.id}`}>Why is this verification being withdrawn?</label>
                    <textarea id={`rr-${r.id}`} name="reason" required minLength={10} rows={2} />
                    <Button type="submit" variant="danger">
                      Withdraw verification
                      <span className="nua-sr-only"> for {label}</span>
                    </Button>
                  </form>
                </>
              ) : (
                <form action={verifyRate} className="nua-stack">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="confirm_hourly_minor" value={r.hourly_minor} />
                  <Filters instrument={instrument} status={status} />
                  <label htmlFor={`rn-${r.id}`}>Where you checked it (guide, page or date)</label>
                  <textarea id={`rn-${r.id}`} name="source_note" required minLength={10} rows={2} />
                  <label>
                    <input name="confirm" type="checkbox" required /> I checked{' '}
                    {dollars(r.hourly_minor)} per hour for {r.instrument} {r.classification} against
                    the official pay guide in force from {day(r.effective_from)}.
                  </label>
                  <Button type="submit">
                    Mark verified<span className="nua-sr-only"> for {label}</span>
                  </Button>
                </form>
              )}
            </article>
          );
        })}
      </section>

      <section className="nua-stack" aria-labelledby="rules-title">
        <h2 id="rules-title">Penalty and loading rules</h2>
        {!rules.response.ok ? <Flash error={errorMessage(rules.error)} /> : null}
        {rules.data?.length === 0 ? <p>No rules match these filters.</p> : null}
        {rules.data?.map((r) => {
          const label = `${r.instrument} ${r.employment} ${DAY_KIND[r.day_kind] ?? r.day_kind} from ${day(r.effective_from)}`;
          return (
            <article className="nua-card nua-stack" key={r.id} aria-label={label}>
              <h3>
                {r.instrument} · {r.employment} · {DAY_KIND[r.day_kind] ?? r.day_kind}
              </h3>
              <p>
                <strong>{percent(r.multiplier_bp)}</strong> of the permanent ordinary hourly rate
                {r.employment === 'casual' ? ' (includes the casual loading)' : ''} · levels{' '}
                {r.classification_codes.join(', ')} · in force from {day(r.effective_from)}
                {r.effective_to ? ` to ${day(r.effective_to)}` : ' (current)'}
              </p>
              <p className="nua-hint">
                Supplied source:{' '}
                <a href={r.source_url} target="_blank" rel="noopener noreferrer">
                  {new URL(r.source_url).hostname}
                </a>
                . {r.source_note}
              </p>
              {r.data_status === 'verified' ? (
                <>
                  <p>
                    <strong>Verified</strong>
                    {r.verified_at
                      ? ` on ${new Date(r.verified_at).toLocaleDateString('en-AU')}`
                      : ''}
                    .
                  </p>
                  <form action={revokePenalty} className="nua-stack">
                    <input type="hidden" name="id" value={r.id} />
                    <Filters instrument={instrument} status={status} />
                    <label htmlFor={`pr-${r.id}`}>Why is this verification being withdrawn?</label>
                    <textarea id={`pr-${r.id}`} name="reason" required minLength={10} rows={2} />
                    <Button type="submit" variant="danger">
                      Withdraw verification
                      <span className="nua-sr-only"> for {label}</span>
                    </Button>
                  </form>
                </>
              ) : (
                <form action={verifyPenalty} className="nua-stack">
                  <input type="hidden" name="id" value={r.id} />
                  <input type="hidden" name="confirm_multiplier_bp" value={r.multiplier_bp} />
                  <Filters instrument={instrument} status={status} />
                  <label htmlFor={`pn-${r.id}`}>Where you checked it (guide, clause or date)</label>
                  <textarea id={`pn-${r.id}`} name="source_note" required minLength={10} rows={2} />
                  <label>
                    <input name="confirm" type="checkbox" required /> I checked{' '}
                    {percent(r.multiplier_bp)} for {r.instrument} {r.employment}{' '}
                    {DAY_KIND[r.day_kind] ?? r.day_kind} against the official pay guide in force
                    from {day(r.effective_from)}.
                  </label>
                  <Button type="submit">
                    Mark verified<span className="nua-sr-only"> for {label}</span>
                  </Button>
                </form>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
