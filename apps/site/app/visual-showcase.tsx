import { FeatureImage, type FeatureSlug } from './visuals';

type Audience = 'jobs' | 'hire' | 'shifts' | 'mobile';

type Visual = {
  slug: FeatureSlug;
  title: string;
  detail: string;
  audiences: Audience[];
};

const visuals: Visual[] = [
  {
    slug: 'job-discovery',
    title: 'Discover hospitality jobs',
    detail: 'See how role, location and pay information can be compared before applying.',
    audiences: ['jobs', 'mobile'],
  },
  {
    slug: 'role-categories',
    title: 'Find your kind of work',
    detail: 'Explore café, bar, kitchen, restaurant and hotel positions by category.',
    audiences: ['jobs'],
  },
  {
    slug: 'location-search',
    title: 'Explore work nearby',
    detail: 'Picture a job search that focuses on the areas where you want to work.',
    audiences: ['jobs'],
  },
  {
    slug: 'availability',
    title: 'Availability on your terms',
    detail: 'Visualise recurring hours, days off and the choice to keep your calendar private.',
    audiences: ['jobs', 'shifts', 'mobile'],
  },
  {
    slug: 'temporary-shifts',
    title: 'Explore temporary shifts',
    detail: 'See the shift details before deciding whether an opportunity is suitable.',
    audiences: ['jobs', 'hire', 'shifts'],
  },
  {
    slug: 'applications',
    title: 'Applications in one place',
    detail: 'Follow a clearer journey from application to employer updates.',
    audiences: ['jobs', 'mobile'],
  },
];

export function VisualShowcase({
  audience = 'all',
  limit,
  exclude = [],
}: {
  audience?: Audience | 'all';
  limit?: number;
  exclude?: FeatureSlug[];
}) {
  const matching = (
    audience === 'all' ? visuals : visuals.filter((visual) => visual.audiences.includes(audience))
  ).filter((visual) => !exclude.includes(visual.slug));
  const selected = typeof limit === 'number' ? matching.slice(0, limit) : matching;

  return (
    <>
      <div className="nua-showcase-grid">
        {selected.map((visual) => (
          <article className="nua-showcase-card" key={visual.slug}>
            <FeatureImage
              slug={visual.slug}
              sizes="(max-width: 660px) 100vw, (max-width: 1080px) 50vw, 33vw"
            />
            <div className="nua-showcase-card__text">
              <h3>{visual.title}</h3>
              <p>{visual.detail}</p>
              <small>Illustrative concept · Product in testing</small>
            </div>
          </article>
        ))}
      </div>
      <p className="nua-visual-note">
        These are illustrative concepts, not screenshots of live accounts. Features and access
        remain subject to testing and launch readiness.
      </p>
    </>
  );
}
