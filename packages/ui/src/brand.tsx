import type { ReactNode } from 'react';

/** The exact connected-people N glyph traced from the owner-approved NUA CREW brand kit. */
export function BrandMark({ size = 40, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 392 343"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
      preserveAspectRatio="xMidYMid meet"
    >
      <path
        d="m270 124-2 2-3 1-2 2-4 2-10 9h-1l-13 13v1l-7 7v1l35 39h1l14-14h1l6-5 10-5h2l4-2h4l1-1h6l1 1v88l1 1v3l2 3v2l3 6 2 2 1 3 3 3v1l3 3v1l12 11h1l6 5 3 1 2 2 8 4h2l4 2h3l1 1h3l2 1 7-8 6-12v-3l1-1v-3l1-1v-7l1-1v-102l-1-1v-7l-1-1v-4l-1-1-2-8-5-10-5-6v-1l-11-11h-1l-3-3-14-8h-2l-3-2h-2l-4-2h-3l-1-1h-5l-1-1h-24l-1 1h-4l-1 1h-3l-1 1h-3l-1 1-5 1-3 2h-2zm-258 16-5 10v2l-2 3v2l-2 4-1 8-1 1v8l-1 1v162l1 1h29l1-1h9l1-1h4l1-1 5-1 3-2h2l6-3 2-2 4-2 9-8v-1l5-5v-1l4-5 4-8v-2l2-4 1-10 1-1v-109l1-1 1 1h4l1 1 6 1 12 6 7 6h1l18 19v1l23 25v1l6 6v1l8 8v1l5 5v1l7 7v1l6 6v1l19 21v1l10 11v1l10 10h1l4 4h1l8 6 14 7h2l3 2h2l4 2h3l1 1h3l1 1h4l1 1h5l1 1h8l1 1h14l1-1h7l1-1 10-1 1-1h3l6-3h2l13-7v-1l-7-3-2-2-3-1-2-2-4-2-4-4h-1l-15-15v-1l-8-8v-1l-6-6v-1l-7-7v-1l-7-7v-1l-7-7v-1l-7-7v-1l-7-7v-1l-7-7v-1l-8-8v-1l-13-14v-1l-24-26v-1l-7-7v-1l-25-27v-1l-20-20h-1l-10-9h-1l-11-8-3-1-2-2-12-6h-2l-3-2h-2l-1-1h-2l-1-1h-2l-4-2h-3l-1-1h-3l-1-1h-4l-1-1h-6l-1-1h-22l-1 1h-6l-1 1h-4l-1 1h-3l-4 2h-3l-3 2h-2l-12 6-2 2-4 2-3 3h-1l-12 12v1l-3 3v1zm296-125-1 1h-4l-1 1h-2l-3 2-4 1-2 2-4 2-9 9-7 14v4l-1 1v13l1 1 1 7 4 8 10 11h1l5 4 6 3 6 1 1 1h6l1 1h4l1-1h6l1-1 6-1 9-5 8-7v-1l5-6 3-6v-2l1-1v-3l1-1v-17l-1-1-1-6-3-6-4-5v-1l-10-9-10-5h-3l-1-1h-4l-1-1zm-238-14-1 1-5 1-7 4-4 4h-1l-7 8-5 10-1 8-1 1v11l1 1v3l1 1 1 5 4 8 7 8h1l3 3h1l5 4h2l6 3h4l1 1h14l1-1h4l14-7 5-5h1v-1l6-7 3-6v-2l2-4v-5l1-1v-8l-1-1v-5l-1-1-1-5-5-9-5-5v-1h-1l-7-6-8-4-6-1-1-1h-16l-1 1z"
        fill="#890A31"
        fillRule="evenodd"
      />
    </svg>
  );
}

/** Compact navigation wordmark paired with the official symbol and approved tagline. */
export function BrandWordmark({
  size = 24,
  product = 'CREW',
}: {
  size?: number;
  product?: string;
}) {
  return (
    <span className="nua-wordmark" style={{ fontSize: size }}>
      <span className="nua-wordmark__nua">NUA</span>{' '}
      <span className="nua-wordmark__crew">{product}</span>
    </span>
  );
}

export function BrandLockup({
  href = '/',
  label = 'NUA CREW home',
}: {
  href?: string;
  label?: string;
}) {
  return (
    <a className="nua-lockup" href={href} aria-label={label}>
      <BrandMark size={46} />
      <span className="nua-lockup__text">
        <BrandWordmark size={23} />
        <span className="nua-brand-tagline">Where Talent Meets Opportunity</span>
      </span>
    </a>
  );
}

export const TAGLINE = 'Where Talent Meets Opportunity';
export const SUPPORT_LINE = 'Real work. Real people. Better matches.';
export const MATCH_DISCLOSURE =
  'Match estimates reflect the information provided. Employers make every hiring decision.';

export function MatchDisclosure({ children }: { children?: ReactNode }) {
  return <p className="nua-hint">{children ?? MATCH_DISCLOSURE}</p>;
}
