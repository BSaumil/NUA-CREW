/**
 * Market configuration is informational until a market passes its own release gates.
 * ISO 3166-1 alpha-2 keys are deliberately open-ended: adding a country should not
 * require branching on AU/NZ in generic application UI.
 */
export type MarketStage = 'prelaunch' | 'preparing' | 'open';
export type MarketConfig = {
  code: string;
  label: string;
  locale: string;
  currency: string;
  phonePrefix: string;
  timezoneExamples: readonly string[];
  regionLabel: string;
  employerIdentifier: string;
  employmentRuleset: string;
  stage: MarketStage;
  employerPaymentsEnabled: boolean;
  jobPublishingEnabled: boolean;
};

export const MARKETS: Record<string, MarketConfig> = {
  AU: {
    code: 'AU',
    label: 'Australia',
    locale: 'en-AU',
    currency: 'AUD',
    phonePrefix: '+61',
    timezoneExamples: [
      'Australia/Melbourne',
      'Australia/Sydney',
      'Australia/Brisbane',
      'Australia/Perth',
      'Australia/Adelaide',
      'Australia/Darwin',
      'Australia/Hobart',
    ],
    regionLabel: 'State or territory',
    employerIdentifier: 'ABN',
    employmentRuleset: 'au-fair-work',
    stage: 'prelaunch',
    employerPaymentsEnabled: false,
    jobPublishingEnabled: false,
  },
  NZ: {
    code: 'NZ',
    label: 'New Zealand',
    locale: 'en-NZ',
    currency: 'NZD',
    phonePrefix: '+64',
    timezoneExamples: ['Pacific/Auckland', 'Pacific/Chatham'],
    regionLabel: 'Region',
    employerIdentifier: 'NZBN',
    employmentRuleset: 'nz-employment-law',
    stage: 'preparing',
    employerPaymentsEnabled: false,
    jobPublishingEnabled: false,
  },
};

/** Fail closed for unknown or incomplete country configuration. */
export function getMarket(code: string): MarketConfig | null {
  const normalised = code.trim().toUpperCase();
  return Object.hasOwn(MARKETS, normalised) ? (MARKETS[normalised] ?? null) : null;
}

/** A marketing entry is never proof the underlying marketplace is open. */
export function isMarketOpen(code: string): boolean {
  const market = getMarket(code);
  return Boolean(market && market.stage === 'open' && market.jobPublishingEnabled);
}

export function formatMarketCurrency(code: string, value: number): string | null {
  const market = getMarket(code);
  if (!market || !Number.isFinite(value)) return null;
  return new Intl.NumberFormat(market.locale, {
    style: 'currency',
    currency: market.currency,
  }).format(value);
}
