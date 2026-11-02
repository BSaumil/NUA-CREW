import { getMarket, isTimeZoneForMarket, type CountryCode } from './countries';

/**
 * Three different questions that must never be merged:
 *
 * 1. Where does a candidate want to *search*? (`CandidateMarketPreference`, a UI intent only)
 * 2. Where is the *workplace*, and so whose employment rules apply? (`WorkplaceJurisdiction`)
 * 3. Which country is the *employer's legal entity* in? (`EmployerEntity`)
 *
 * Workplace jurisdiction and entity country come only from an explicit choice or a verified
 * record. They are never inferred from an IP address, device location, phone prefix or flag.
 */

/** UI search default only. It is never used to decide pay, tax, privacy or legal treatment. */
export const DEFAULT_SEARCH_MARKETS: readonly CountryCode[] = Object.freeze(['AU']);

export interface CandidateMarketPreference {
  /** Where the candidate lives. Optional and never used to infer a workplace. */
  residenceCountry: CountryCode | null;
  searchCountries: readonly CountryCode[];
}

/** Accepts "AU,NZ", ["AU","NZ"] or junk. Unknown codes are dropped; empty falls back to the search default. */
export function parseSearchMarkets(raw: unknown): CountryCode[] {
  const parts = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : [];
  const seen = new Set<CountryCode>();
  for (const part of parts) {
    const market = getMarket(part);
    if (market) seen.add(market.code);
  }
  return seen.size > 0 ? [...seen] : [...DEFAULT_SEARCH_MARKETS];
}

export const serialiseSearchMarkets = (codes: readonly CountryCode[]): string =>
  parseSearchMarkets(codes).join(',');

export interface WorkplaceJurisdiction {
  workplaceCountryCode: CountryCode;
  workplaceRegionCode?: string;
  /** IANA zone supplied by the venue, never the viewer's device. */
  timeZone: string;
}

/**
 * Builds a workplace jurisdiction from explicit input only. There is no default country: a
 * missing or unknown country, a zone that does not belong to that country, or a region code that
 * the market does not define all return `null`.
 */
export function makeWorkplaceJurisdiction(input: {
  countryCode: unknown;
  regionCode?: unknown;
  timeZone: unknown;
}): WorkplaceJurisdiction | null {
  const market = getMarket(input.countryCode);
  if (!market) return null;
  if (!isTimeZoneForMarket(market.code, input.timeZone)) return null;
  const timeZone = input.timeZone as string;
  if (input.regionCode === undefined || input.regionCode === null || input.regionCode === '') {
    return { workplaceCountryCode: market.code, timeZone };
  }
  const region = market.regions.find((r) => r.code !== undefined && r.code === input.regionCode);
  if (!region?.code) return null;
  return { workplaceCountryCode: market.code, workplaceRegionCode: region.code, timeZone };
}

export interface EmployerEntity {
  entityCountryCode: CountryCode;
  identifierType: string;
}

export function makeEmployerEntity(countryCode: unknown): EmployerEntity | null {
  const market = getMarket(countryCode);
  return market
    ? { entityCountryCode: market.code, identifierType: market.identifier.label }
    : null;
}
