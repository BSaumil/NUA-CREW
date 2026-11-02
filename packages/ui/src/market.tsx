'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import {
  allows,
  disabledReason,
  listMarkets,
  resolveMarketState,
  type Capability,
  type MarketState,
} from '@nua-crew/markets';

/**
 * Country selection for employer forms. The chosen country only decides which fields are shown
 * and whether the submit control may act. It never converts one country's data into another's:
 * previews use their own field names and are never sent to an Australian-only endpoint.
 */
interface Gate {
  country: string;
  state: MarketState;
  setCountry: (code: string) => void;
  capability: Capability;
}
const MarketContext = createContext<Gate | null>(null);

export function MarketProvider({
  capability,
  initial = 'AU',
  children,
}: {
  capability: Capability;
  initial?: string;
  children: ReactNode;
}) {
  const [country, setCountry] = useState(initial);
  const state = resolveMarketState(country);
  return (
    <MarketContext.Provider value={{ country, state, setCountry, capability }}>
      {children}
    </MarketContext.Provider>
  );
}

/** `null` outside a provider. Inside, tells a submit control whether it may act and why not. */
export function useMarketGate(): { allowed: boolean; reason: string | null } | null {
  const ctx = useContext(MarketContext);
  if (!ctx) return null;
  return {
    allowed: allows(ctx.state, ctx.capability),
    reason: disabledReason(ctx.state, ctx.capability),
  };
}

export function MarketRadios({
  name = 'country',
  legend = 'Business country',
}: {
  name?: string;
  legend?: string;
}) {
  const ctx = useContext(MarketContext);
  if (!ctx) return null;
  return (
    <fieldset className="nua-market-choice">
      <legend>{legend}</legend>
      {listMarkets().map((market) => {
        const preview = market.uiStage !== 'existing-flow';
        return (
          <label key={market.code} className="nua-market-choice__option">
            <input
              type="radio"
              name={name}
              value={market.code}
              checked={ctx.country === market.code}
              onChange={() => ctx.setCountry(market.code)}
            />
            <span>
              {market.label} <span className="nua-hint">({market.currency})</span>
              {preview ? <span className="nua-badge"> Preview only</span> : null}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}

/** Location and identifier fields for the selected country. Australian markup and names are unchanged. */
export function MarketLocationFields() {
  const ctx = useContext(MarketContext);
  if (!ctx || ctx.state.kind === 'blocked') return null;
  const market = ctx.state.market;
  const live = ctx.state.kind === 'supported-for-transactions';
  // Preview fields use their own names so they can never be read as an Australian payload.
  const p = live ? '' : `${market.code.toLowerCase()}_preview_`;
  const idId = live ? 'abn' : `${p}identifier`;
  return (
    <>
      <div className="nua-field">
        <label htmlFor={idId}>
          {market.identifier.label}
          {market.code === 'AU' ? ' (optional at setup)' : ' (optional)'}
        </label>
        <input
          id={idId}
          name={live ? 'abn' : `${p}identifier`}
          inputMode="numeric"
          aria-describedby={`${idId}-hint`}
        />
        <p id={`${idId}-hint`} className="nua-hint">
          {market.identifier.hint}
        </p>
      </div>
      <div className="nua-grid">
        <div className="nua-field">
          <label htmlFor={`${p}suburb`}>Suburb</label>
          <input id={`${p}suburb`} name={live ? 'suburb' : `${p}suburb`} required />
        </div>
        <div className="nua-field">
          <label htmlFor={`${p}state`}>{live ? 'State' : market.regionLabel}</label>
          <select
            id={`${p}state`}
            name={live ? 'state' : `${p}region`}
            required
            defaultValue={live ? 'VIC' : ''}
          >
            {live ? null : <option value="">Choose…</option>}
            {market.regions.map((r) => (
              <option key={r.label} value={r.code ?? r.label}>
                {r.code ?? r.label}
              </option>
            ))}
          </select>
        </div>
        <div className="nua-field">
          <label htmlFor={`${p}postcode`}>{market.postcode.label}</label>
          <input
            id={`${p}postcode`}
            name={live ? 'postcode' : `${p}postcode`}
            required
            inputMode="numeric"
          />
        </div>
      </div>
    </>
  );
}

/** Tells the person, in words, why a preview cannot be submitted. */
export function MarketPreviewNotice() {
  const ctx = useContext(MarketContext);
  if (!ctx || allows(ctx.state, ctx.capability)) return null;
  const reason = disabledReason(ctx.state, ctx.capability);
  return (
    <p role="status" className="nua-alert" data-testid="market-preview-notice">
      {reason} Pay in {ctx.state.kind === 'blocked' ? 'this country' : ctx.state.market.currency} is
      not assessed, and no wage or eligibility is stated.
    </p>
  );
}

/** Wrap a submit control so it stays disabled, with the reason, when the market cannot act. */
export function GatedSubmit({ children, pending }: { children: ReactNode; pending?: boolean }) {
  const gate = useMarketGate();
  const blocked = gate ? !gate.allowed : false;
  return (
    <>
      <button
        className="nua-button"
        type="submit"
        disabled={blocked || pending}
        aria-disabled={blocked || pending}
        aria-describedby={blocked ? 'market-gate-reason' : undefined}
      >
        {children}
      </button>
      {blocked ? (
        <p id="market-gate-reason" className="nua-hint">
          {gate?.reason}
        </p>
      ) : null}
    </>
  );
}
