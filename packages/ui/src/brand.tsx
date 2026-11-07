import type { ReactNode } from 'react';

/**
 * Approved symbol (two connected figures forming an N), served from each app's `/brand/` folder.
 * Use this, not the full logo, at small sizes. Pass `title` only when it stands alone: next to the
 * visible words "NUA CREW" it is decorative.
 */
export function BrandMark({ size = 40, title }: { size?: number; title?: string }) {
  return (
    <img
      src="/brand/nua-crew-symbol.svg"
      height={size}
      width={Math.round((size * 392) / 343)}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      className="nua-mark"
    />
  );
}

/**
 * The approved horizontal master logo, which has the tagline built in. Do not render the tagline
 * again beside it. `tile` sets it on warm ivory for dark surfaces such as the site footer; the
 * artwork itself is never recoloured.
 */
export function BrandLogo({
  width = 220,
  tile = false,
  decorative = false,
}: {
  width?: number;
  tile?: boolean;
  decorative?: boolean;
}) {
  return (
    <span className={tile ? 'nua-logo nua-logo--tile' : 'nua-logo'}>
      <img
        src="/brand/nua-crew-logo.svg"
        width={width}
        height={Math.round((width * 604) / 1030)}
        alt={decorative ? '' : `NUA CREW — ${TAGLINE}`}
        aria-hidden={decorative ? true : undefined}
      />
    </span>
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
      <BrandMark size={36} />
      <BrandWordmark size={24} />
    </a>
  );
}

/** Approved tagline (brand kit, 2026-11-07). */
export const TAGLINE = 'Where Talent Meets Opportunity';
export const SUPPORT_LINE = 'Real work. Real people. Better matches.';
export const MATCH_DISCLOSURE =
  'Match estimates reflect the information provided. Employers make every hiring decision.';

export function MatchDisclosure({ children }: { children?: ReactNode }) {
  return <p className="nua-hint">{children ?? MATCH_DISCLOSURE}</p>;
}
