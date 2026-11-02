import { CAPABILITIES, getMarket, type Capability, type CountryCode } from './countries';

/**
 * The shape the backend is expected to publish per market. This is a design intent from the
 * UX/backend handoff, not an assertion that an endpoint exists: until one does, callers pass
 * `undefined` and every non-legacy market stays in preview.
 */
export interface MarketPublicInfo {
  countryCode: CountryCode;
  locale: string;
  currency: string;
  regionLabel: string;
  employerIdentifierLabel: string;
  capabilities: Readonly<Record<Capability, boolean>>;
}

export type ParsedMarketInfo = { ok: true; info: MarketPublicInfo } | { ok: false; reason: string };

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const nonEmpty = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;

/**
 * Validates untrusted server data. Anything missing, mistyped or inconsistent with the local
 * display configuration is rejected, so a bad response can only ever leave a market in preview.
 */
export function parseMarketPublicInfo(raw: unknown): ParsedMarketInfo {
  if (!isRecord(raw)) return { ok: false, reason: 'Market information is not an object.' };
  const market = getMarket(raw.countryCode);
  if (!market) return { ok: false, reason: 'Unknown or unconfigured country.' };
  if (raw.countryCode !== market.code)
    return { ok: false, reason: 'Country code is not normalised.' };
  if (!nonEmpty(raw.locale)) return { ok: false, reason: 'Missing locale.' };
  if (raw.currency !== market.currency) {
    return { ok: false, reason: 'Currency does not match this market.' };
  }
  if (!nonEmpty(raw.regionLabel)) return { ok: false, reason: 'Missing region label.' };
  if (raw.employerIdentifierLabel !== market.identifier.label) {
    return { ok: false, reason: 'Employer identifier does not match this market.' };
  }
  if (!isRecord(raw.capabilities)) return { ok: false, reason: 'Missing capabilities.' };
  const caps = {} as Record<Capability, boolean>;
  for (const cap of CAPABILITIES) {
    const value = raw.capabilities[cap];
    if (typeof value !== 'boolean')
      return { ok: false, reason: `Capability "${cap}" is not a boolean.` };
    caps[cap] = value;
  }
  return {
    ok: true,
    info: {
      countryCode: market.code,
      locale: raw.locale,
      currency: market.currency,
      regionLabel: raw.regionLabel,
      employerIdentifierLabel: market.identifier.label,
      capabilities: Object.freeze(caps),
    },
  };
}
