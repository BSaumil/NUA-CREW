import { useId } from 'react';

export type MatchComponentView = {
  key: string;
  weight: number;
  evaluated: boolean;
  score: number | null;
  evidence: string;
  basis: string;
};

const LABELS: Record<string, string> = {
  semantic: 'Meaning similarity',
  skills: 'Skills',
  experience: 'Experience',
  commute: 'Location',
  salary: 'Pay',
  preference: 'Your preferences',
  trajectory: 'Career path',
};

export function MatchBreakdown({
  estimate,
  components,
  missingSkills = [],
  label = 'Estimated match — not a prediction of being hired',
}: {
  estimate: number | null;
  components: MatchComponentView[];
  missingSkills?: string[];
  label?: string;
}) {
  const id = useId();
  return (
    <section className="nua-card nua-stack" aria-labelledby={id}>
      <div className="nua-row" style={{ justifyContent: 'space-between' }}>
        <h2 id={id} style={{ margin: 0 }}>
          My match
        </h2>
        <span className="nua-badge nua-badge--live">
          <span className="nua-dot" aria-hidden="true" />
          {estimate == null ? 'Not enough information' : `${Math.round(estimate)}% estimate`}
        </span>
      </div>
      <p className="nua-hint">{label}</p>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} className="nua-stack">
        {components.map((c) => (
          <li key={c.key}>
            <div className="nua-row" style={{ justifyContent: 'space-between' }}>
              <strong>{LABELS[c.key] ?? c.key}</strong>
              <span className="nua-muted">
                {c.evaluated ? `${Math.round((c.score ?? 0) * 100)}%` : 'Not evaluated'}
              </span>
            </div>
            {c.evaluated ? (
              <div
                className="nua-meter"
                role="meter"
                aria-label={`${LABELS[c.key] ?? c.key} match`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round((c.score ?? 0) * 100)}
              >
                <span style={{ width: `${Math.round((c.score ?? 0) * 100)}%` }} />
              </div>
            ) : null}
            <p className="nua-hint" style={{ margin: '4px 0 0' }}>
              {c.evidence}
            </p>
          </li>
        ))}
      </ul>
      {missingSkills.length ? (
        <p>
          <strong>Skills to add or build:</strong> {missingSkills.join(', ')}
        </p>
      ) : null}
    </section>
  );
}
