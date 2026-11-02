"""Non-mutating inspection of legacy job country evidence.

Legacy locations.country has an AU server default, so agreement between
location country and pay currency alone cannot prove a verified jurisdiction.
Only a separate reviewed provenance process may authorise a backfill.
"""

from dataclasses import dataclass
from enum import StrEnum

from app.markets import MarketUnavailable, market_for


class EvidenceState(StrEnum):
    MISSING_WORKPLACE = "missing_workplace"
    UNCONFIGURED_WORKPLACE = "unconfigured_workplace"
    MISSING_CURRENCY = "missing_currency"
    CURRENCY_CONFLICT = "currency_conflict"
    CONSISTENT_UNVERIFIED = "consistent_unverified"


@dataclass(frozen=True, slots=True)
class LegacyCountryEvidence:
    state: EvidenceState
    candidate_country: str | None
    eligible_for_automatic_backfill: bool = False


def review_legacy_job(
    *,
    location_country: str | None,
    pay_currency: str | None,
) -> LegacyCountryEvidence:
    """Advisory only: no input can automatically authorise a country migration."""
    if not location_country or not location_country.strip():
        return LegacyCountryEvidence(EvidenceState.MISSING_WORKPLACE, None)

    try:
        market = market_for(location_country)
    except MarketUnavailable:
        return LegacyCountryEvidence(EvidenceState.UNCONFIGURED_WORKPLACE, None)

    if not pay_currency or not pay_currency.strip():
        return LegacyCountryEvidence(EvidenceState.MISSING_CURRENCY, market.country_code)

    if pay_currency.strip().upper() != market.currency:
        return LegacyCountryEvidence(EvidenceState.CURRENCY_CONFLICT, market.country_code)

    # locations.country may be a database default, not documented employer evidence.
    return LegacyCountryEvidence(EvidenceState.CONSISTENT_UNVERIFIED, market.country_code)
