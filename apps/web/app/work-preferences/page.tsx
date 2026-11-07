import type { Metadata } from 'next';
import { Button } from '@nua-crew/ui';
import type { Schemas } from '@nua-crew/contracts';
import { api, requireCandidate } from '@/lib/api';
import { saveWorkPreferences, setKindDiscovery } from '../actions';
import { Flash, flashFrom } from '../components';

export const metadata: Metadata = { title: 'Work preferences', robots: { index: false } };

type Pref = Schemas['WorkPreferenceOut'] | null;
const ENGAGEMENT = [
  ['employee', 'Employee'],
  ['contractor', 'Contractor'],
] as const;
const HOURS = [
  ['full_time', 'Full-time'],
  ['part_time', 'Part-time'],
  ['casual', 'Casual'],
] as const;

function Kind({
  kind,
  title,
  pref,
}: {
  kind: 'permanent' | 'temporary';
  title: string;
  pref: Pref;
}) {
  const k = (name: string) => `${kind}_${name}`;
  return (
    <fieldset className="nua-card nua-stack">
      <legend>
        <h2>{title}</h2>
      </legend>
      <input type="hidden" name={k('exists')} value={pref ? '1' : '0'} />
      <label className="nua-market-choice__option">
        <input type="checkbox" name={k('enabled')} defaultChecked={pref?.enabled ?? false} />
        <span>I am open to {kind} work</span>
      </label>
      <fieldset className="nua-market-choice">
        <legend>Arrangement you are open to</legend>
        {ENGAGEMENT.map(([v, l]) => (
          <label key={v} className="nua-market-choice__option">
            <input
              type="checkbox"
              name={k('engagement')}
              value={v}
              defaultChecked={pref?.engagement_bases.includes(v) ?? false}
            />
            <span>{l}</span>
          </label>
        ))}
        <p className="nua-hint">
          This is a preference, not a check of your status. Ticking contractor does not make anyone
          a contractor in law.
        </p>
      </fieldset>
      <fieldset className="nua-market-choice">
        <legend>Hours pattern</legend>
        {HOURS.map(([v, l]) => (
          <label key={v} className="nua-market-choice__option">
            <input
              type="checkbox"
              name={k('hours')}
              value={v}
              defaultChecked={pref?.hours_patterns.includes(v) ?? false}
            />
            <span>{l}</span>
          </label>
        ))}
      </fieldset>
      <div className="nua-grid">
        <div className="nua-field">
          <label htmlFor={k('min_weekly')}>Fewest hours a week</label>
          <input
            id={k('min_weekly')}
            name={k('min_weekly')}
            inputMode="decimal"
            defaultValue={pref?.min_weekly_hours ?? ''}
          />
        </div>
        <div className="nua-field">
          <label htmlFor={k('max_weekly')}>Most hours a week</label>
          <input
            id={k('max_weekly')}
            name={k('max_weekly')}
            inputMode="decimal"
            defaultValue={pref?.max_weekly_hours ?? ''}
          />
        </div>
        <div className="nua-field">
          <label htmlFor={k('min_pay')}>Lowest hourly pay you would consider</label>
          <input
            id={k('min_pay')}
            name={k('min_pay')}
            inputMode="decimal"
            defaultValue={pref?.min_hourly_pay ?? ''}
            aria-describedby={k('min_pay_hint')}
          />
          <p id={k('min_pay_hint')} className="nua-hint">
            Private. Never shown to employers, and not used to rank you.
          </p>
        </div>
        {kind === 'permanent' ? (
          <>
            <div className="nua-field">
              <label htmlFor="permanent_notice">Notice period (days)</label>
              <input
                id="permanent_notice"
                name="permanent_notice"
                inputMode="numeric"
                defaultValue={pref?.notice_period_days ?? ''}
              />
            </div>
            <div className="nua-field">
              <label htmlFor="permanent_available_from">Available to start from</label>
              <input
                id="permanent_available_from"
                name="permanent_available_from"
                type="date"
                defaultValue={pref?.available_from ?? ''}
                aria-describedby="from-hint"
              />
              <p id="from-hint" className="nua-hint">
                A permanent start date. Whether you can work a shift tonight is a different
                question.
              </p>
            </div>
          </>
        ) : (
          <div className="nua-field">
            <label htmlFor="temporary_travel">Furthest you will travel (km)</label>
            <input
              id="temporary_travel"
              name="temporary_travel"
              inputMode="numeric"
              defaultValue={pref?.max_travel_km ?? ''}
            />
          </div>
        )}
      </div>
    </fieldset>
  );
}

function Discovery({ kind, label, pref }: { kind: string; label: string; pref: Pref }) {
  if (!pref?.enabled) return null;
  return (
    <form
      action={setKindDiscovery}
      className="nua-row"
      aria-label={`Employer discovery for ${label}`}
    >
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="granted" value={pref.discoverable ? '0' : '1'} />
      <p style={{ margin: 0 }}>
        {label}: employers {pref.discoverable ? 'can' : 'cannot'} find you.
      </p>
      <Button type="submit" variant="secondary">
        {pref.discoverable ? 'Stop employers finding me' : 'Let verified employers find me'}
        <span className="nua-sr-only"> for {label}</span>
      </Button>
    </form>
  );
}

export default async function WorkPreferences({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireCandidate();
  const { error, notice } = await flashFrom(searchParams);
  const { data, error: loadError } = await (await api()).GET('/v1/candidate/work-preferences');
  return (
    <div className="nua-stack" style={{ maxWidth: 720 }}>
      <h1>What kind of work do you want?</h1>
      <p>
        Choose one or both. Each has its own answers, and switching one off keeps what you entered.
        These are private to you.
      </p>
      <Flash error={error} notice={notice} />
      {loadError || !data ? (
        <p role="alert">
          We couldn’t load your preferences. <a href="/work-preferences">Try again</a>.
        </p>
      ) : (
        <>
          <form action={saveWorkPreferences} className="nua-stack">
            <Kind kind="permanent" title="Permanent work" pref={data.permanent} />
            <Kind kind="temporary" title="Temporary work" pref={data.temporary} />
            <p>
              <Button type="submit">Save work preferences</Button>
            </p>
          </form>
          <section className="nua-card nua-stack" aria-labelledby="disc-h">
            <h2 id="disc-h">Let employers find you</h2>
            <p>
              Off by default and separate for each kind of work. It also needs the talent-discovery
              switch on your <a href="/profile">profile</a>. Employers never see your pay floor or
              calendar, and contact only happens through an invitation you can accept or decline.
            </p>
            <Discovery kind="permanent" label="Permanent work" pref={data.permanent} />
            <Discovery kind="temporary" label="Temporary work" pref={data.temporary} />
            {!data.permanent?.enabled && !data.temporary?.enabled ? (
              <p className="nua-hint">Save a kind of work above to choose this.</p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
