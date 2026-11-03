import { useSyncExternalStore } from 'react';
import {
  allows,
  disabledReason,
  getMarket,
  listMarkets,
  parseSearchMarkets,
  resolveMarketState,
  type Capability,
  type MarketState,
} from '@nua-crew/markets';

/**
 * Market handling for the app. This is display and form configuration only: country-legal and
 * pay decisions come from the backend, and a preview-only market can never submit.
 */
export { allows, disabledReason, getMarket, listMarkets, resolveMarketState };
export type { Capability, MarketState };

/** Region codes the existing Australian flow accepts, from the shared registry. */
export const AU_STATES: readonly string[] = (getMarket('AU')?.regions ?? []).flatMap((r) =>
  r.code ? [r.code] : [],
);

/** Why a control for `country` is disabled, or null when the existing flow allows it. */
export function gateFor(country: string, capability: Capability) {
  const state = resolveMarketState(country);
  return { allowed: allows(state, capability), reason: disabledReason(state, capability), state };
}

// Search-market intent lives in memory only: not in AsyncStorage, not on the server, and it
// never decides workplace law or pay.
let searchMarkets: readonly string[] = parseSearchMarkets(undefined);
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function useSearchMarkets(): readonly string[] {
  return useSyncExternalStore(
    subscribe,
    () => searchMarkets,
    () => searchMarkets,
  );
}

export function toggleSearchMarket(code: string) {
  const next = searchMarkets.includes(code)
    ? searchMarkets.filter((c) => c !== code)
    : [...searchMarkets, code];
  // An empty selection falls back to the default search market rather than searching nowhere.
  searchMarkets = parseSearchMarkets(next);
  listeners.forEach((l) => l());
}

export function resetSearchMarkets() {
  searchMarkets = parseSearchMarkets(undefined);
  listeners.forEach((l) => l());
}

/** Markets whose listings can be requested now, and the notices for the rest. */
export function planSearch(markets: readonly string[]) {
  const searchable: string[] = [];
  const unavailable: { code: string; label: string; reason: string }[] = [];
  for (const code of markets) {
    const label = getMarket(code)?.label ?? code;
    if (allows(resolveMarketState(code), 'onboarding')) searchable.push(code);
    else
      unavailable.push({
        code,
        label,
        reason: `${label} jobs and applications are not enabled yet. Nothing is listed for ${label} until its records are verified.`,
      });
  }
  return { searchable, unavailable };
}
