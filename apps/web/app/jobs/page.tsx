import type { Metadata } from 'next';
import { listMarkets } from '@nua-crew/markets';
import { EmptyState, JobCard } from '@nua-crew/ui';
import { api, getViewer, toCard, type Job } from '@/lib/api';
import { planSearch } from '@/lib/search-markets';
import { saveSearch } from '../actions';
import { Flash, flashFrom } from '../components';

export const metadata: Metadata = { title: 'Find jobs' };

const TYPES = [
  ['', 'Any type'],
  ['full_time', 'Full time'],
  ['part_time', 'Part time'],
  ['casual', 'Casual'],
  ['contract', 'Contract'],
  ['shift', 'Shift'],
] as const;

export default async function Jobs({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { p, error, notice } = await flashFrom(searchParams);
  // A failed backend must not turn the public jobs page into an HTTP 500.
  // Do not treat an outage as an empty, authoritative set of job listings.
  let listingsUnavailable = false;
  let viewer: Awaited<ReturnType<typeof getViewer>> = null;
  try {
    viewer = await getViewer();
  } catch {
    listingsUnavailable = true;
  }
  const one = (k: string) =>
    (Array.isArray(p[k]) ? p[k]![0] : (p[k] as string | undefined)) || undefined;
  const rawMarkets = p['markets'];
  const plan = planSearch(rawMarkets);
  const mixed = plan.markets.length > 1;
  const page = Math.max(1, Number(one('page') ?? 1) || 1);
  const query = {
    q: one('q'),
    suburb: one('suburb'),
    employment_type: one('type'),
    page,
    page_size: 12,
  };
  // Only markets with an existing flow are queried; a preview-only market is never requested.
  let jobs: Job[] = [];
  let total = 0;
  if (plan.searchable.length > 0) {
    try {
      const response = await (await api()).GET('/v1/jobs', { params: { query } });
      if (!response.data || response.error) {
        listingsUnavailable = true;
      } else {
        jobs = response.data.items;
        total = response.data.total;
      }
    } catch {
      listingsUnavailable = true;
    }
  }
  const qs = (n: number) =>
    new URLSearchParams(
      Object.entries({
        q: query.q,
        suburb: query.suburb,
        type: query.employment_type,
        markets: plan.markets.join(','),
        page: String(n),
      }).filter((e): e is [string, string] => Boolean(e[1])),
    ).toString();

  return (
    <div className="nua-stack">
      <h1>Find jobs</h1>
      <Flash error={error} notice={notice} />
      <form method="get" role="search" aria-label="Filter jobs" className="nua-card">
        <div className="nua-grid">
          <div className="nua-field">
            <label htmlFor="q">Keywords</label>
            <input id="q" name="q" defaultValue={query.q ?? ''} />
          </div>
          <div className="nua-field">
            <label htmlFor="suburb">Suburb</label>
            <input id="suburb" name="suburb" defaultValue={query.suburb ?? ''} />
          </div>
          <div className="nua-field">
            <label htmlFor="type">Employment type</label>
            <select id="type" name="type" defaultValue={query.employment_type ?? ''}>
              {TYPES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </div>
        </div>
        <fieldset className="nua-market-choice">
          <legend>Search in</legend>
          {listMarkets().map((m) => (
            <label key={m.code} className="nua-market-choice__option">
              <input
                type="checkbox"
                name="markets"
                value={m.code}
                defaultChecked={plan.markets.includes(m.code)}
              />
              <span>
                {m.label} <span className="nua-hint">({m.currency})</span>
              </span>
            </label>
          ))}
          <p className="nua-hint">
            This only chooses what to show. It does not decide pay rules for any workplace.
          </p>
        </fieldset>
        <p>
          <button className="nua-button" type="submit">
            Search
          </button>
        </p>
      </form>
      {plan.unavailable.map((u) => (
        <p key={u.code} role="status" className="nua-alert" data-testid={`market-notice-${u.code}`}>
          {u.reason}
        </p>
      ))}
      {mixed ? (
        <p className="nua-hint">
          Pay is shown in each job&rsquo;s own currency and is never added together or compared
          across countries.
        </p>
      ) : null}
      {listingsUnavailable ? (
        <p role="alert" className="nua-alert" data-testid="job-listings-unavailable">
          Job listings are temporarily unavailable. Please try again shortly.
        </p>
      ) : (
        <p role="status" className="nua-muted">
          {total} {total === 1 ? 'job' : 'jobs'} found
        </p>
      )}
      {!listingsUnavailable && viewer?.role === 'candidate' ? (
        <form action={saveSearch} className="nua-card nua-stack" aria-label="Save this search">
          <input type="hidden" name="q" value={query.q ?? ''} />
          <input type="hidden" name="suburb" value={query.suburb ?? ''} />
          <input type="hidden" name="type" value={query.employment_type ?? ''} />
          <div className="nua-field">
            <label htmlFor="search-name">Name this search</label>
            <input id="search-name" name="name" maxLength={200} />
          </div>
          <label className="nua-market-choice__option">
            <input type="checkbox" name="alerts" defaultChecked />
            <span>Tell me when new jobs match</span>
          </label>
          <p className="nua-hint">
            Saves keywords, suburb and employment type.{' '}
            <a href="/saved-searches">Your saved searches</a>
          </p>
          <p>
            <button className="nua-button nua-button--secondary" type="submit">
              Save this search
            </button>
          </p>
        </form>
      ) : null}
      {listingsUnavailable ? null : jobs.length === 0 ? (
        <EmptyState title="No jobs match yet" description="Try fewer filters or a nearby suburb." />
      ) : (
        <div className="nua-grid">
          {jobs.map((j) => (
            <JobCard key={j.id} job={toCard(j)} href={`/jobs/${j.id}`} showCurrencyCode={mixed} />
          ))}
        </div>
      )}
      {!listingsUnavailable ? (
        <nav aria-label="Pagination" className="nua-row">
        {page > 1 ? <a href={`/jobs?${qs(page - 1)}`}>Previous</a> : null}
        {page * 12 < total ? <a href={`/jobs?${qs(page + 1)}`}>Next</a> : null}
        </nav>
      ) : null}
    </div>
  );
}
