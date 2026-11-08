import { ArrowRight } from 'lucide-react';
import { LAUNCH } from '@/lib/site';

/**
 * The three first-class entry points. When an entry is not open its button goes to the launch
 * status page and says so; nothing here implies a workflow works before its flag is on.
 */
export function EntryPoints({ compact = false }: { compact?: boolean }) {
  return (
    <section className="entry-points" aria-label="Get started">
      <ul>
        {LAUNCH.list.map((e) => (
          <li key={e.id} data-entry={e.id} data-open={e.open}>
            <a
              className={`nua-button${e.id === 'employee' ? '' : ' nua-button--secondary'}`}
              href={e.href}
            >
              {e.label} <ArrowRight size={18} aria-hidden="true" />
            </a>
            {compact ? null : <p>{e.open ? e.blurb : e.closedNote}</p>}
          </li>
        ))}
      </ul>
      <p className="entry-points__price">
        Planned employer pricing: A$49 for a 14-day advertisement, optional A$30 5-day promotion,
        A$79 together. Payments are not switched on.
      </p>
    </section>
  );
}
