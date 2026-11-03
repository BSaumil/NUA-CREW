import type { ReactNode } from 'react';

/** Icon-only glyph (interlocking N). Use this, not the full lockup, at small sizes. */
export function BrandMark({ size = 40, title }: { size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 1024 1024"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      focusable="false"
    >
      <rect width="1024" height="1024" rx="220" fill="#3C0B21" />
      <path
        d="M288 776V248L736 776V248"
        fill="none"
        stroke="#F7F3EF"
        strokeWidth="112"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M288 776V224L736 776"
        fill="none"
        stroke="#C9A96E"
        strokeWidth="28"
        strokeLinecap="round"
      />
      <circle cx="288" cy="776" r="28" fill="#0FA3B1" />
      <circle cx="736" cy="248" r="56" fill="#0FA3B1" />
    </svg>
  );
}

/** Master wordmark NUA with the subordinate CREW descriptor. Text is real text, not an image. */
export function BrandWordmark({
  size = 24,
  product = 'CREW',
}: {
  size?: number;
  product?: string;
}) {
  return (
    <span className="nua-wordmark" style={{ fontSize: size }}>
      <span>NUA</span>
      {/* A real space keeps the visible text "NUA CREW" matching the link's accessible name. */}{' '}
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
      <BrandMark size={40} />
      <BrandWordmark size={24} />
    </a>
  );
}

export const TAGLINE = 'Better Jobs. Stronger Teams.';
export const SUPPORT_LINE = 'Real work. Real people. Better matches.';
export const MATCH_DISCLOSURE =
  'Match estimates reflect the information provided. Employers make every hiring decision.';

export function MatchDisclosure({ children }: { children?: ReactNode }) {
  return <p className="nua-hint">{children ?? MATCH_DISCLOSURE}</p>;
}
