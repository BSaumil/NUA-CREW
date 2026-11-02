import { allows, disabledReason, resolveMarketState, type Capability } from '@nua-crew/markets';

/**
 * Server-side market gate. The form's client gate is a convenience; this is the check that stops
 * a non-Australian payload reaching the Australian-only API. A missing or unknown country fails
 * closed: there is no implicit Australian default.
 */
export function marketRefusal(form: FormData, capability: Capability): string | null {
  const state = resolveMarketState(form.get('country') ?? form.get('workplace_country'));
  return allows(state, capability) ? null : disabledReason(state, capability);
}
