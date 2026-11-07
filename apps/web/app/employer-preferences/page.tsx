import type { Metadata } from 'next';
import { Button } from '@nua-crew/ui';
import { api, requireCandidate } from '@/lib/api';
import { addEmployerPreference, removeEmployerPreference } from '../actions';
import { Flash, flashFrom } from '../components';

export const metadata: Metadata = {
  title: 'Employers you prefer or avoid',
  robots: { index: false },
};

const KIND_LABEL: Record<string, string> = {
  follow: 'Prefer',
  hide_from: 'Hide jobs from',
  mute: 'Mute',
  block: 'Blocked',
};

export default async function EmployerPreferences({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCandidate();
  const { error, notice, p } = await flashFrom(searchParams);
  const q = (Array.isArray(p.q) ? p.q[0] : p.q)?.trim() ?? '';
  const client = await api();
  const [{ data: prefs, error: loadError }, found] = await Promise.all([
    client.GET('/v1/candidate/employer-preferences'),
    q.length >= 2
      ? client.GET('/v1/candidate/employer-directory', { params: { query: { q } } })
      : Promise.resolve({ data: undefined }),
  ]);
  return (
    <div className="nua-stack" style={{ maxWidth: 720 }}>
      <h1>Employers you prefer or avoid</h1>
      <p>
        These choices are private. Preferring an employer tells us you would like to hear from them.
        Blocking stops them finding or inviting you and closes any conversation with them.
      </p>
      <Flash error={error} notice={notice} />

      <form method="get" role="search" aria-label="Find an employer" className="nua-card nua-stack">
        <div className="nua-field">
          <label htmlFor="q">Find an employer by name</label>
          <input id="q" name="q" defaultValue={q} minLength={2} maxLength={100} />
        </div>
        <p>
          <Button type="submit" variant="secondary">
            Search
          </Button>
        </p>
      </form>

      {q.length >= 2 ? (
        <section className="nua-stack" aria-labelledby="res-h">
          <h2 id="res-h">Results</h2>
          {found.data && found.data.length > 0 ? (
            <ul className="nua-stack" aria-label="Employers found">
              {found.data.map((e) => (
                <li key={e.id} className="nua-card nua-stack">
                  <strong>{e.name}</strong>
                  <form action={addEmployerPreference} className="nua-row">
                    <input type="hidden" name="employer_id" value={e.id} />
                    {(['follow', 'hide_from', 'mute'] as const).map((k) => (
                      <Button key={k} type="submit" name="kind" value={k} variant="secondary">
                        {KIND_LABEL[k]}
                        <span className="nua-sr-only"> {e.name}</span>
                      </Button>
                    ))}
                  </form>
                  <details>
                    <summary>Block {e.name}</summary>
                    <form action={addEmployerPreference} className="nua-stack">
                      <input type="hidden" name="employer_id" value={e.id} />
                      <input type="hidden" name="kind" value="block" />
                      <p>
                        They will not be able to find, invite or message you, any conversation with
                        them closes and pending invitations end. You can undo this below.
                      </p>
                      <label className="nua-market-choice__option">
                        <input type="checkbox" name="understand" />
                        <span>I want to block {e.name}.</span>
                      </label>
                      <Button type="submit" variant="danger">
                        Block {e.name}
                      </Button>
                    </form>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <p className="nua-hint">No employers match “{q}”.</p>
          )}
        </section>
      ) : null}

      <section className="nua-stack" aria-labelledby="mine-h">
        <h2 id="mine-h">Your choices</h2>
        {loadError || !prefs ? (
          <p role="alert">
            We couldn’t load your choices. <a href="/employer-preferences">Try again</a>.
          </p>
        ) : prefs.length === 0 ? (
          <p className="nua-hint">You have not set any.</p>
        ) : (
          <ul className="nua-stack" aria-label="Your choices">
            {prefs.map((x) => (
              <li key={x.id} className="nua-card nua-row">
                <span>
                  {x.employer_name}:{' '}
                  <span className="nua-badge">{KIND_LABEL[x.kind] ?? x.kind}</span>
                </span>
                <form action={removeEmployerPreference}>
                  <input type="hidden" name="id" value={x.id} />
                  <Button type="submit" variant="secondary">
                    {x.kind === 'block' ? 'Unblock' : 'Remove'}
                    <span className="nua-sr-only">
                      {' '}
                      {x.employer_name} ({KIND_LABEL[x.kind] ?? x.kind})
                    </span>
                  </Button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
