/**
 * Frontend market registry: display and form configuration only.
 *
 * Nothing in this file can enable a transaction. Whether a market may onboard employers, publish
 * jobs, book shifts or take payment is decided by the backend (see `state.ts` and `server.ts`);
 * the only exception is the pre-existing Australian flow, which is labelled as such.
 *
 * Countries are keyed by ISO 3166-1 alpha-2 code. Adding a country means adding one entry here
 * with every capability left to the server; generic UI must never branch on "AU" or "NZ".
 */

/** A validated ISO 3166-1 alpha-2 code, upper-case. Use `getMarket` to turn input into a market. */
export type CountryCode = string;

export const isCountryCodeShape = (value: unknown): value is CountryCode =>
  typeof value === 'string' && /^[A-Z]{2}$/.test(value);

export type Capability = 'onboarding' | 'job_publishing' | 'shifts' | 'billing';
export const CAPABILITIES: readonly Capability[] = [
  'onboarding',
  'job_publishing',
  'shifts',
  'billing',
];

/**
 * - `existing-flow`: the product already works for this country; the UI does not change it.
 * - `preparing`: preview only. Forms render, but nothing is submitted or published.
 * - `display-only`: information may be shown; there is no workflow at all.
 */
export type UiStage = 'existing-flow' | 'preparing' | 'display-only';

export interface Region {
  label: string;
  /** Backend value. Absent until the backend contract defines it, so the option cannot be submitted. */
  code?: string;
}

export interface IdentifierRule {
  label: string;
  hint: string;
  /** Format check only. It never proves a business exists or is eligible. */
  pattern: RegExp;
  note: string;
}

export interface TimeZoneOption {
  id: string;
  label: string;
}

export interface MarketConfig {
  code: CountryCode;
  label: string;
  locale: string;
  currency: string;
  phonePrefix: string;
  regionLabel: string;
  regions: readonly Region[];
  postcode: { label: string; hint: string; pattern: RegExp };
  timeZones: readonly TimeZoneOption[];
  /** Extra IANA prefixes accepted for this market besides the listed zones. */
  timeZonePrefixes: readonly string[];
  identifier: IdentifierRule;
  uiStage: UiStage;
}

const AU_STATES: readonly Region[] = [
  { code: 'VIC', label: 'Victoria' },
  { code: 'NSW', label: 'New South Wales' },
  { code: 'QLD', label: 'Queensland' },
  { code: 'SA', label: 'South Australia' },
  { code: 'WA', label: 'Western Australia' },
  { code: 'TAS', label: 'Tasmania' },
  { code: 'ACT', label: 'Australian Capital Territory' },
  { code: 'NT', label: 'Northern Territory' },
];

// Labels only: backend region codes for New Zealand are not defined yet.
const NZ_REGIONS: readonly Region[] = [
  'Northland',
  'Auckland',
  'Waikato',
  'Bay of Plenty',
  'Gisborne',
  "Hawke's Bay",
  'Taranaki',
  'Manawatū-Whanganui',
  'Wellington',
  'Tasman',
  'Nelson',
  'Marlborough',
  'West Coast',
  'Canterbury',
  'Otago',
  'Southland',
].map((label) => ({ label }));

export const MARKETS: Readonly<Record<CountryCode, MarketConfig>> = {
  AU: {
    code: 'AU',
    label: 'Australia',
    locale: 'en-AU',
    currency: 'AUD',
    phonePrefix: '+61',
    regionLabel: 'State or territory',
    regions: AU_STATES,
    postcode: { label: 'Postcode', hint: 'Four digits', pattern: /^\d{4}$/ },
    timeZones: [
      { id: 'Australia/Melbourne', label: 'Melbourne' },
      { id: 'Australia/Sydney', label: 'Sydney' },
      { id: 'Australia/Brisbane', label: 'Brisbane' },
      { id: 'Australia/Adelaide', label: 'Adelaide' },
      { id: 'Australia/Perth', label: 'Perth' },
      { id: 'Australia/Hobart', label: 'Hobart' },
      { id: 'Australia/Darwin', label: 'Darwin' },
    ],
    timeZonePrefixes: ['Australia/'],
    identifier: {
      label: 'ABN',
      hint: '11 digits. Providing an ABN does not complete business verification.',
      pattern: /^\d{11}$/,
      note: 'An ABN check alone never verifies a business or its representative.',
    },
    uiStage: 'existing-flow',
  },
  NZ: {
    code: 'NZ',
    label: 'New Zealand',
    locale: 'en-NZ',
    currency: 'NZD',
    phonePrefix: '+64',
    regionLabel: 'Region',
    regions: NZ_REGIONS,
    postcode: { label: 'Postcode', hint: 'Four digits', pattern: /^\d{4}$/ },
    timeZones: [
      { id: 'Pacific/Auckland', label: 'Auckland' },
      { id: 'Pacific/Chatham', label: 'Chatham Islands' },
    ],
    timeZonePrefixes: [],
    identifier: {
      label: 'NZBN',
      hint: '13 digits. How NZ businesses are verified has not been approved yet.',
      pattern: /^\d{13}$/,
      note: 'Whether an NZBN, or another NZ check, is the right way to verify a business is still to be decided.',
    },
    uiStage: 'preparing',
  },
};

/**
 * The only way to turn input into a market. Unknown, malformed or non-string input is `null`;
 * there is no fallback country. Prototype keys such as "constructor" never match.
 */
export function getMarket(code: unknown): MarketConfig | null {
  if (typeof code !== 'string') return null;
  const normalised = code.trim().toUpperCase();
  if (!isCountryCodeShape(normalised)) return null;
  return Object.hasOwn(MARKETS, normalised) ? (MARKETS[normalised] ?? null) : null;
}

export const listMarkets = (): readonly MarketConfig[] => Object.values(MARKETS);

export function isTimeZoneForMarket(code: unknown, timeZone: unknown): boolean {
  const market = getMarket(code);
  if (!market || typeof timeZone !== 'string' || !timeZone) return false;
  const known =
    market.timeZones.some((z) => z.id === timeZone) ||
    market.timeZonePrefixes.some((p) => timeZone.startsWith(p));
  if (!known) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone });
    return true;
  } catch {
    return false;
  }
}
