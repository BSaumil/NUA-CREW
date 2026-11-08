/**
 * Where a person may be sent back to after signing in or registering. An open redirect would let
 * anyone craft a NUA CREW link that lands a signed-in person on another site, so this accepts only
 * an exact allow-list of in-app paths and falls back to a safe default for everything else
 * (absolute URLs, protocol-relative `//host`, backslashes, encoded tricks, other pages).
 */
export const RETURN_TO_ALLOWED = ['/', '/jobs', '/jobs/new', '/jobs/new/guided'] as const;

export function safeReturnTo(value: unknown, fallback: string = '/'): string {
  if (typeof value !== 'string') return fallback;
  // No trimming: whitespace or control characters mean the value is not one of ours.
  return (RETURN_TO_ALLOWED as readonly string[]).includes(value) ? value : fallback;
}
