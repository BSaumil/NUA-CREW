import { ArrowRight, BriefcaseBusiness, Building2, UserRound } from 'lucide-react';
import { LAUNCH } from '@/lib/site';

const choices = {
  employee: { Icon: UserRound, detail: 'Find work · always free' },
  employer: { Icon: Building2, detail: 'Set up your hiring workspace' },
  'post-job': { Icon: BriefcaseBusiness, detail: 'Check job publishing availability' },
} as const;

/**
 * Compact, full-row navigation for the three hiring paths.
 * Access is still controlled by LAUNCH; this presentation never unlocks signups.
 */
export function EntryPoints({ compact = false }: { compact?: boolean }) {
  return (
    <section className="entry-points" aria-label="Get started">
      <p className="entry-points__eyebrow">Choose your path</p>
      <ul className="entry-points__list">
        {LAUNCH.list.map((entry) => {
          const { Icon, detail } = choices[entry.id];
          return (
            <li key={entry.id} data-entry={entry.id} data-open={entry.open}>
              <a className="entry-points__link" href={entry.href}>
                <span className="entry-points__icon" aria-hidden="true">
                  <Icon size={19} strokeWidth={1.9} />
                </span>
                <span className="entry-points__copy">
                  <span className="entry-points__title">{entry.label}</span>
                  {!compact ? <span className="entry-points__detail">{detail}</span> : null}
                </span>
                <ArrowRight className="entry-points__arrow" size={18} aria-hidden="true" />
              </a>
            </li>
          );
        })}
      </ul>
      <p className="entry-points__notice">
        {LAUNCH.anyOpen
          ? 'Web registration is available. Check job posting for publishing availability.'
          : 'Pilot registration is not open yet. Each option shows its launch status.'}
      </p>
    </section>
  );
}
