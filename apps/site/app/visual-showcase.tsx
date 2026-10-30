import Image from 'next/image';

type Audience = 'jobs' | 'hire' | 'shifts' | 'mobile';

type Visual = {
  slug: string;
  title: string;
  detail: string;
  alt: string;
  audiences: Audience[];
};

const visuals: Visual[] = [
  {
    slug: 'job-discovery',
    title: 'Discover hospitality jobs',
    detail: 'See how role, location and pay information can be compared before applying.',
    alt: 'Illustration of NUA CREW hospitality job discovery cards on a phone',
    audiences: ['jobs', 'mobile'],
  },
  {
    slug: 'role-categories',
    title: 'Find your kind of work',
    detail: 'Explore café, bar, kitchen, restaurant and hotel positions by category.',
    alt: 'Illustrated category tiles for hospitality roles',
    audiences: ['jobs'],
  },
  {
    slug: 'location-search',
    title: 'Explore work nearby',
    detail: 'Picture a job search that focuses on the areas where you want to work.',
    alt: 'Illustration of a location-based hospitality job search',
    audiences: ['jobs'],
  },
  {
    slug: 'availability',
    title: 'Availability on your terms',
    detail: 'Visualise recurring hours, days off and the choice to keep your calendar private.',
    alt: 'Concept screen showing a weekly work availability planner',
    audiences: ['jobs', 'shifts', 'mobile'],
  },
  {
    slug: 'temporary-shifts',
    title: 'Explore temporary shifts',
    detail: 'See the shift details before deciding whether an opportunity is suitable.',
    alt: 'Illustrated temporary hospitality shift marketplace on a smartphone',
    audiences: ['jobs', 'hire', 'shifts'],
  },
  {
    slug: 'applications',
    title: 'Applications in one place',
    detail: 'Follow a clearer journey from application to employer updates.',
    alt: 'Illustration of job applications and progress in the NUA CREW mobile app',
    audiences: ['jobs', 'mobile'],
  },
  {
    slug: 'resume-certificates',
    title: 'Prepare your profile',
    detail: 'See how a resume and relevant qualifications could be organised.',
    alt: 'Illustration showing a resume and qualifications in a candidate profile',
    audiences: ['jobs'],
  },
  {
    slug: 'employer-posting',
    title: 'Create a clearer job post',
    detail: 'Present the role, location, hours and disclosed pay together.',
    alt: 'Illustration of an employer completing a hospitality job advertisement',
    audiences: ['hire'],
  },
  {
    slug: 'shortlisting',
    title: 'Review applicants thoughtfully',
    detail: 'Explore an organised view of candidates and hiring decisions.',
    alt: 'Illustration of a hiring pipeline and candidate shortlisting interface',
    audiences: ['hire'],
  },
  {
    slug: 'invitations',
    title: 'Invitations and interviews',
    detail: 'Show the invitation clearly and give each person the choice to reply.',
    alt: 'Illustration of interview and hiring invitations on a mobile phone',
    audiences: ['hire', 'jobs', 'mobile'],
  },
  {
    slug: 'messaging',
    title: 'Keep conversations together',
    detail: 'See how conversations can stay connected to an opportunity.',
    alt: 'Concept illustration of secure candidate and employer messaging',
    audiences: ['hire', 'jobs', 'mobile'],
  },
  {
    slug: 'pay-guidance',
    title: 'Understand the pay reference',
    detail: 'A visual guide to award coverage, classification and an employer-disclosed offer.',
    alt: 'Illustration of an Australian hospitality pay guidance screen',
    audiences: ['hire', 'jobs'],
  },
  {
    slug: 'credentials',
    title: 'Share relevant documents',
    detail:
      'Preview the journey for resumes, RSA and other certificates; verification is separate.',
    alt: 'Illustration of RSA and qualification documents attached to a profile',
    audiences: ['jobs', 'hire'],
  },
  {
    slug: 'shift-roster',
    title: 'Follow shift records',
    detail: 'Visualise scheduled shifts, attendance and requested corrections.',
    alt: 'Illustrated hospitality shift roster and attendance timeline',
    audiences: ['hire', 'shifts', 'mobile'],
  },
  {
    slug: 'alerts',
    title: 'Stay informed',
    detail: 'Imagine job and application updates in one organised place.',
    alt: 'Illustration of job notifications and application alerts',
    audiences: ['jobs', 'mobile'],
  },
  {
    slug: 'venue-management',
    title: 'Keep venue hiring organised',
    detail: 'See how jobs, applicants and recruitment tasks fit into one workspace.',
    alt: 'Illustration of a hospitality venue recruitment management dashboard',
    audiences: ['hire'],
  },
];

export function VisualShowcase({
  audience = 'all',
  limit,
}: {
  audience?: Audience | 'all';
  limit?: number;
}) {
  const matching =
    audience === 'all' ? visuals : visuals.filter((visual) => visual.audiences.includes(audience));
  const selected = typeof limit === 'number' ? matching.slice(0, limit) : matching;

  return (
    <>
      <div className="nua-showcase-grid">
        {selected.map((visual) => (
          <article className="nua-showcase-card" key={visual.slug}>
            <Image
              src={`/brand-kit/features/${visual.slug}.webp`}
              alt={visual.alt}
              width={1400}
              height={1060}
              sizes="(max-width: 660px) 100vw, (max-width: 1080px) 50vw, 33vw"
              loading="lazy"
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

const venueBanners = [
  {
    slug: 'cafes-restaurants',
    title: 'Cafés and restaurants',
    alt: 'NUA CREW hospitality banner showing café and restaurant work',
    body: 'From a local café to a busy dining room.',
  },
  {
    slug: 'hotels-events',
    title: 'Hotels and events',
    alt: 'NUA CREW banner illustrating hotel and banquet hospitality careers',
    body: 'Roles that span hotels, events and functions.',
  },
  {
    slug: 'employer-workspace',
    title: 'Hiring teams',
    alt: 'NUA CREW branded illustration of an employer hiring workspace',
    body: 'One visual overview of the hiring journey.',
  },
  {
    slug: 'career-progression',
    title: 'Hospitality careers',
    alt: 'NUA CREW banner showing hospitality career progression concepts',
    body: 'Find your next step, whatever your experience.',
  },
];

export function VenueBanners() {
  return (
    <>
      <div className="nua-venue-gallery">
        {venueBanners.map((banner) => (
          <figure className="nua-venue-card" key={banner.slug}>
            <Image
              src={`/brand-kit/banners/${banner.slug}.webp`}
              alt={banner.alt}
              width={2400}
              height={900}
              sizes="(max-width: 800px) 100vw, 50vw"
              loading="lazy"
            />
            <figcaption>
              <strong>{banner.title}</strong>
              <span>{banner.body}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <p className="nua-visual-note">
        Concept artwork illustrating different parts of hospitality.
      </p>
    </>
  );
}
