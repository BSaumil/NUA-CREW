import type { ReactNode } from 'react';
import Image from 'next/image';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  FileCheck,
  Search,
  Send,
  Users,
} from 'lucide-react';

/** Clean feature illustrations, all 1448 x 987. They are concepts, not screenshots. */
export const FEATURE_IMAGES = {
  'job-discovery': {
    alt: 'Illustration of NUA CREW hospitality job discovery on a phone',
  },
  'role-categories': {
    alt: 'Illustrated category tiles for hospitality roles',
  },
  'location-search': {
    alt: 'Illustration of a location-based hospitality job search',
  },
  availability: {
    alt: 'Concept screen showing a weekly work availability planner',
  },
  'temporary-shifts': {
    alt: 'Illustrated temporary hospitality shifts on a smartphone',
  },
  applications: {
    alt: 'Illustration of job applications and progress in the NUA CREW mobile app',
  },
} as const;

export type FeatureSlug = keyof typeof FEATURE_IMAGES;

export function FeatureImage({
  slug,
  sizes,
  priority,
}: {
  slug: FeatureSlug;
  sizes: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={`/brand-kit/features/${slug}.webp`}
      alt={FEATURE_IMAGES[slug].alt}
      width={1448}
      height={987}
      sizes={sizes}
      priority={priority}
      loading={priority ? undefined : 'lazy'}
    />
  );
}

export type FeatureRow = {
  kicker: string;
  title: string;
  body: ReactNode;
  href: string;
  linkLabel: string;
  /** An illustration or an HTML interface preview. */
  visual: ReactNode;
};

/** Alternating image-and-text rows. Each row explains one thing with one picture. */
export function FeatureRows({ rows }: { rows: FeatureRow[] }) {
  return (
    <div className="feature-rows">
      {rows.map((row) => (
        <article className="feature-row" key={row.title}>
          <div className="feature-row__visual">{row.visual}</div>
          <div className="feature-row__copy">
            <p className="section-kicker">{row.kicker}</p>
            <h3>{row.title}</h3>
            <p>{row.body}</p>
            <a className="text-link" href={row.href}>
              {row.linkLabel} <ArrowRight size={17} aria-hidden="true" />
            </a>
          </div>
        </article>
      ))}
    </div>
  );
}

/** Wraps an HTML preview so assistive technology gets one description, not the sample data. */
export function PreviewFrame({
  label,
  caption = 'Concept preview with fictional sample data.',
  tone = 'light',
  children,
}: {
  label: string;
  caption?: string;
  tone?: 'light' | 'dark';
  children: ReactNode;
}) {
  return (
    <figure className={`preview-frame preview-frame--${tone}`}>
      <div className="preview-frame__stage" role="img" aria-label={label}>
        <div aria-hidden="true">{children}</div>
      </div>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}

export function JobSearchPreview() {
  return (
    <div className="ui-card job-preview">
      <div className="job-preview__search">
        <Search size={16} aria-hidden="true" />
        <span>Barista, Fitzroy</span>
      </div>
      <ul className="job-preview__list">
        <li>
          <div>
            <strong>Barista</strong>
            <span>Fitzroy · Casual</span>
          </div>
          <em className="chip chip--ok">Pay disclosed</em>
        </li>
        <li>
          <div>
            <strong>Kitchen hand</strong>
            <span>Richmond · Part time</span>
          </div>
          <em className="chip">Pay not disclosed</em>
        </li>
      </ul>
    </div>
  );
}

export function HiringDashboardPreview() {
  const rows: [string, string, string][] = [
    ['Alex C.', 'Barista · Fitzroy', 'Applied'],
    ['Sam K.', 'Kitchen hand · Richmond', 'Shortlisted by your team'],
    ['Jordan P.', 'Floor staff · Carlton', 'Interview invited'],
  ];
  return (
    <div className="ui-card dash-preview">
      <div className="dash-preview__head">
        <strong>Barista · Fitzroy</strong>
        <em className="chip chip--ok">Pay disclosed</em>
      </div>
      <p className="dash-preview__label">Applicants</p>
      <ul className="dash-preview__list">
        {rows.map(([name, role, stage]) => (
          <li key={name}>
            <div>
              <strong>{name}</strong>
              <span>{role}</span>
            </div>
            <em className="chip">{stage}</em>
          </li>
        ))}
      </ul>
      <p className="dash-preview__note">Your team makes every hiring decision.</p>
    </div>
  );
}

export function ConversationPreview() {
  return (
    <div className="ui-card convo-preview">
      <p className="convo-preview__label">Conversation · opened after an accepted invitation</p>
      <p className="convo-bubble convo-bubble--them">
        Thanks for accepting. Are you free Tuesday morning for a trial?
      </p>
      <p className="convo-bubble convo-bubble--you">Yes, 7 to 11 works for me.</p>
      <p className="convo-bubble convo-bubble--them">Great. We will confirm the details here.</p>
    </div>
  );
}

const JOURNEY: { icon: typeof Search; title: string; body: string }[] = [
  { icon: Search, title: 'Search', body: 'Look by role, suburb and clearly labelled pay.' },
  { icon: FileCheck, title: 'Apply', body: 'Apply once with a resume and follow its progress.' },
  { icon: Users, title: 'Review', body: 'Hiring teams review applicants in one pipeline.' },
  { icon: Send, title: 'Invite', body: 'Invite people who chose to be found. They can say no.' },
  {
    icon: CalendarCheck,
    title: 'Hire',
    body: 'People decide. NUA CREW never makes a hiring decision.',
  },
];

/** The whole journey in five steps, as real text with icons. */
export function JourneySteps() {
  return (
    <ol className="journey-steps">
      {JOURNEY.map((step, i) => (
        <li key={step.title}>
          <span className="journey-steps__icon" aria-hidden="true">
            <step.icon size={22} strokeWidth={1.8} />
          </span>
          <span className="journey-steps__num">Step {i + 1}</span>
          <h3>{step.title}</h3>
          <p>{step.body}</p>
        </li>
      ))}
    </ol>
  );
}

/** Employer advertising options compared in real HTML (planned pricing, billing not live). */
export function AdOptionsComparison() {
  const rows: [string, string, string][] = [
    ['Planned price', 'A$19', 'A$49 (A$19 + A$30)'],
    ['Runs for', '14 days', '14-day advertisement, with a 5-day promotion within it'],
    [
      'Where it appears',
      'In search and job lists like any other job',
      'As above, plus a planned reserved place in the top five for a local category, subject to capacity',
    ],
    ['Labelling', 'Standard listing', 'Always labelled as promoted'],
    [
      'Renewal',
      'None. Re-advertise only if you choose',
      'None. Another promotion is a separate A$30',
    ],
  ];
  return (
    <div className="ad-compare">
      <table>
        <caption className="nua-sr-only">
          Comparison of the planned employer advertising options
        </caption>
        <thead>
          <tr>
            <td />
            <th scope="col">Advertisement</th>
            <th scope="col">Advertisement + promotion</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, a, b]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              <td data-label="Advertisement">{a}</td>
              <td data-label="Advertisement + promotion">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="ad-compare__note">
        <CheckCircle2 size={16} aria-hidden="true" /> Planned pricing only. Payments are not live.
      </p>
    </div>
  );
}
