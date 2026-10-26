import type { Metadata } from 'next';
import { EmptyState, JobCard } from '@nua-crew/ui';
import { api, toCard } from '@/lib/api';
import { flashFrom } from '../components';

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
  const { p } = await flashFrom(searchParams);
  const one = (k: string) =>
    (Array.isArray(p[k]) ? p[k]![0] : (p[k] as string | undefined)) || undefined;
  const page = Math.max(1, Number(one('page') ?? 1) || 1);
  const query = {
    q: one('q'),
    suburb: one('suburb'),
    employment_type: one('type'),
    page,
    page_size: 12,
  };
  const { data } = await (await api()).GET('/v1/jobs', { params: { query } });
  const jobs = data?.items ?? [];
  const total = data?.total ?? 0;
  const qs = (n: number) =>
    new URLSearchParams(
      Object.entries({
        q: query.q,
        suburb: query.suburb,
        type: query.employment_type,
        page: String(n),
      }).filter((e): e is [string, string] => Boolean(e[1])),
    ).toString();

  return (
    <div className="nua-stack">
      <h1>Find jobs</h1>
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
        <p>
          <button className="nua-button" type="submit">
            Search
          </button>
        </p>
      </form>
      <p role="status" className="nua-muted">
        {total} {total === 1 ? 'job' : 'jobs'} found
      </p>
      {jobs.length === 0 ? (
        <EmptyState title="No jobs match yet" description="Try fewer filters or a nearby suburb." />
      ) : (
        <div className="nua-grid">
          {jobs.map((j) => (
            <JobCard key={j.id} job={toCard(j)} href={`/jobs/${j.id}`} />
          ))}
        </div>
      )}
      <nav aria-label="Pagination" className="nua-row">
        {page > 1 ? <a href={`/jobs?${qs(page - 1)}`}>Previous</a> : null}
        {page * 12 < total ? <a href={`/jobs?${qs(page + 1)}`}>Next</a> : null}
      </nav>
    </div>
  );
}
