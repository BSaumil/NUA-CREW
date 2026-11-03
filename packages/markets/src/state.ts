import { getMarket, type Capability, type MarketConfig } from './countries';
import { parseMarketPublicInfo } from './server';

/**
 * What the UI may do for a market.
 *
 * - `supported-for-display`: information only; there is no workflow.
 * - `preparing`: preview only. Nothing is saved, published, booked or charged.
 * - `blocked`: unknown or unconfigured. Fail closed; never substitute another country.
 * - `supported-for-transactions`: reachable only through the pre-existing Australian flow
 *   (`existing-flow`, behaviour unchanged) or a validated server response (`server`).
 */
export type MarketState =
  | { kind: 'supported-for-display'; market: MarketConfig }
  | { kind: 'preparing'; market: MarketConfig; reason: string }
  | { kind: 'blocked'; reason: string }
  | {
      kind: 'supported-for-transactions';
      market: MarketConfig;
      via: 'existing-flow' | 'server';
      /** `null` for the existing flow: the server keeps enforcing it exactly as before. */
      capabilities: Readonly<Record<Capability, boolean>> | null;
    };

const previewReason = (market: MarketConfig) =>
  `${market.label} is being prepared. This preview does not save, publish, book or charge anything.`;

/**
 * Resolve a market's state. `serverInfo` is untrusted data from a future capability endpoint:
 * it can enable capabilities only when it validates, and it can also switch capabilities off.
 * There is no local flag, environment variable or default that turns a transaction on for any
 * market other than the pre-existing Australian flow.
 */
export function resolveMarketState(code: unknown, serverInfo?: unknown): MarketState {
  const market = getMarket(code);
  if (!market) return { kind: 'blocked', reason: 'This country is not set up yet.' };

  if (serverInfo !== undefined) {
    const parsed = parseMarketPublicInfo(serverInfo);
    if (parsed.ok && parsed.info.countryCode === market.code) {
      const anyOn = Object.values(parsed.info.capabilities).some(Boolean);
      return anyOn
        ? {
            kind: 'supported-for-transactions',
            market,
            via: 'server',
            capabilities: parsed.info.capabilities,
          }
        : { kind: 'preparing', market, reason: previewReason(market) };
    }
    // Unusable server data never upgrades anything. Only the legacy flow ignores it.
    if (market.uiStage !== 'existing-flow') {
      return { kind: 'preparing', market, reason: previewReason(market) };
    }
  }

  switch (market.uiStage) {
    case 'existing-flow':
      return {
        kind: 'supported-for-transactions',
        market,
        via: 'existing-flow',
        capabilities: null,
      };
    case 'preparing':
      return { kind: 'preparing', market, reason: previewReason(market) };
    case 'display-only':
      return { kind: 'supported-for-display', market };
  }
}

/** True only when the UI may let this capability act. Previews and unknown markets are false. */
export function allows(state: MarketState, capability: Capability): boolean {
  if (state.kind !== 'supported-for-transactions') return false;
  return state.capabilities === null ? true : state.capabilities[capability];
}

/** A short, accurate sentence for a disabled control. */
export function disabledReason(state: MarketState, capability: Capability): string | null {
  if (allows(state, capability)) return null;
  switch (state.kind) {
    case 'blocked':
      return state.reason;
    case 'preparing':
      return state.reason;
    case 'supported-for-display':
      return `${state.market.label} is shown for information only.`;
    case 'supported-for-transactions':
      return `${state.market.label} has not been approved for this yet.`;
  }
}
