import { ArrowRight } from 'lucide-react';
import { LAUNCH } from '@/lib/site';

const audience = {
  employee: 'I am looking for work',
  employer: 'I am hiring',
  'post-job': 'I have a role to fill',
} as const;

/**
 * Give visitors three clear choices without presenting pre-launch links as working registration.
 * The common notice explains the closed state once rather than repeating warnings below every CTA.
 */
export function EntryPoints({ compact = false }: { compact?: boolean }) {
  return (
    <section className="entry-points" aria-label="Get started">
      <ul>
        {LAUNCH.list.map((entry) => (
          <li
            key={entry.id}
            className="entry-points__card"
            data-entry={entry.id}
            data-open={entry.open}
          >
            <div className="entry-points__topline">
              <span className="entry-points__audience">{audience[entry.id]}</span>
              <span className="entry-points__status">
                {entry.open ? 'Pilot access' : 'Not open yet'}
              </span>
            </div>
            <a
              className={`nua-button${entry.id === 'employee' ? '' : ' nua-button--secondary'}`}
              href={entry.href}
            >
              {entry.label} <ArrowRight size={18} aria-hidden="true" />
            </a>
            {!compact && (entry.open || entry.id === 'post-job') ? (
              <p className="entry-points__description">{entry.blurb}</p>
            ) : null}
          </li>
        ))}
      </ul>
      <p className="entry-points__notice">
        {LAUNCH.anyOpen
          ? 'Access is for approved pilot users. Unavailable options show their launch status. Payments are not switched on.'
          : 'Pilot registration is not open yet. Choose an option to see its launch status. Payments are not switched on.'}
      </p>
    </section>
  );
}
