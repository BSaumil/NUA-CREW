import { parseSearchMarkets, resolveMarketState, allows, getMarket } from '@nua-crew/markets';

/**
 * Search-market intent for the candidate site. It is a view filter only: it is read from the
 * URL, never stored, never sent as workplace jurisdiction, and never replaces tenant or role
 * checks. The jobs API does not yet return a verified country per record, so no record can be
 * labelled with one and none can be listed as a verified result for another country.
 */
export interface SearchPlan {
  markets: string[];
  /** Markets whose listings can be requested today (existing Australian flow). */
  searchable: string[];
  /** Markets selected but not yet available, with the reason to show. */
  unavailable: { code: string; label: string; reason: string }[];
}

export function planSearch(raw: unknown): SearchPlan {
  const markets = parseSearchMarkets(raw);
  const searchable: string[] = [];
  const unavailable: SearchPlan['unavailable'] = [];
  for (const code of markets) {
    const state = resolveMarketState(code);
    const label = getMarket(code)?.label ?? code;
    if (allows(state, 'onboarding')) searchable.push(code);
    else
      unavailable.push({
        code,
        label,
        reason: `${label} jobs and applications are not enabled yet. Nothing is listed for ${label} until its records are verified.`,
      });
  }
  return { markets, searchable, unavailable };
}
