import type { ReactNode } from 'react';

/** Approved connected-people N mark, from the official NUA CREW brand kit. */
export function BrandMark({ size = 40, title }: { size?: number; title?: string }) {
  return (
    <img
      src="/brand/nua-crew-symbol.svg"
      width={size}
      height={size}
      alt={title ?? ''}
      aria-hidden={title ? undefined : true}
      style={{ objectFit: 'contain', flexShrink: 0 }}
    />
  );
}

/** Text fallback for compact interfaces; the complete approved logo is BrandLockup. */
export function BrandWordmark({ size = 24 }: { size?: number; product?: string }) {
  return (
    <span className="nua-wordmark" style={{ fontSize: size }}>
      <span>NUA</span>{' '}
      <span className="nua-wordmark__crew">CREW</span>
    </span>
  );
}

/** Full approved master includes the exact tagline. Never append it again inside this lockup. */
export function BrandLockup({ href = '/', label = 'NUA CREW home' }: { href?: string; label?: string }) {
  return (
    <a className="nua-lockup" href={href} aria-label={label}>
      <img
        src="/brand/nua-crew-logo.svg"
        width={190}
        height={112}
        alt=""
        aria-hidden="true"
        style={{ width: 'min(190px, 100%)', height: 'auto', display: 'block' }}
      />
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
