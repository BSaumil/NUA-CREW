import type { Metadata } from 'next';
import { EmptyState } from '@nua-crew/ui';
import { api, requireCandidate } from '@/lib/api';
import { describeSearch, extraFilters, searchHref } from '@/lib/saved-search';
import { deleteSearch, setSearchAlerts } from '../actions';
import { Flash, flashFrom } from '../components';

export const metadata: Metadata = { title: 'Saved searches' };

export default async function SavedSearches({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireCandidate();
  const { error, notice } = await flashFrom(searchParams);
  const { data, error: loadError } = await (await api()).GET('/v1/candidate/saved-searches');
  const searches = data ?? [];
  return (
    <div className="nua-stack">
      <h1>Saved searches</h1>
      <p>
        Save a search on the <a href="/jobs">jobs page</a> and we will add an alert to your updates
        when new matching jobs appear (at most one an hour per search). Alerts show in your updates,
        and as a phone notification if you have switched those on.
      </p>
      <Flash error={error} notice={notice} />
      {loadError ? (
        <p role="alert">
          We couldn’t load your saved searches. <a href="/saved-searches">Try again</a>.
        </p>
      ) : searches.length === 0 ? (
        <EmptyState
          title="No saved searches yet"
          description="Run a search on the jobs page, then choose Save this search."
        />
      ) : (
        <ul className="nua-stack" aria-label="Your saved searches">
          {searches.map((s) => {
            const extra = extraFilters(s.params);
            return (
              <li key={s.id} className="nua-card nua-stack">
                <h2>{s.name}</h2>
                <p>{describeSearch(s.params)}</p>
                {extra.length ? (
                  <p className="nua-hint">
                    Also uses {extra.join(', ')} from the phone app. The alert includes these; the
                    jobs page link below does not.
                  </p>
                ) : null}
                <p className="nua-hint">
                  Alerts are {s.alerts_enabled ? 'on' : 'off'}
                  {s.last_alerted_at
                    ? ` · last alert ${new Date(s.last_alerted_at).toLocaleDateString('en-AU')}`
                    : ''}
                </p>
                <div className="nua-row">
                  <a className="nua-button nua-button--secondary" href={searchHref(s.params)}>
                    See jobs
                  </a>
                  <form action={setSearchAlerts}>
                    <input type="hidden" name="search_id" value={s.id} />
                    <input type="hidden" name="alerts" value={s.alerts_enabled ? 'off' : 'on'} />
                    <button className="nua-button nua-button--secondary" type="submit">
                      {s.alerts_enabled ? 'Turn alerts off' : 'Turn alerts on'}
                      <span className="nua-sr-only"> for {s.name}</span>
                    </button>
                  </form>
                  <form action={deleteSearch}>
                    <input type="hidden" name="search_id" value={s.id} />
                    <button className="nua-button nua-button--danger" type="submit">
                      Delete<span className="nua-sr-only"> {s.name}</span>
                    </button>
                  </form>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
