"""Country-aware backend rules, independent of the marketing-site configuration.

Fail closed for unknown countries and prohibited transactional operations. This
module does not assert that New Zealand hiring or wage calculations are live.
"""

from dataclasses import dataclass
from decimal import Decimal
from enum import StrEnum
from typing import Literal


class MarketUnavailable(ValueError):
    """The jurisdiction or capability has not been approved for public use."""


class Capability(StrEnum):
    ONBOARDING = "onboarding"
    JOB_PUBLISHING = "job_publishing"
    SHIFTS = "shifts"
    BILLING = "billing"


@dataclass(frozen=True, slots=True)
class Market:
    country_code: str
    locale: str
    currency: str
    employment_ruleset: str
    business_identifier: str
    label: str
    region_label: str
    phone_prefix: str
    time_zones: tuple[str, ...]
    stage: Literal["prelaunch", "preparing", "open"]
    capabilities: frozenset[Capability] = frozenset()


_MARKETS: dict[str, Market] = {
    "AU": Market(
        country_code="AU",
        locale="en-AU",
        currency="AUD",
        employment_ruleset="au-fair-work",
        business_identifier="ABN",
        label="Australia",
        region_label="State or territory",
        phone_prefix="+61",
        time_zones=(
            "Australia/Melbourne",
            "Australia/Sydney",
            "Australia/Brisbane",
            "Australia/Perth",
            "Australia/Adelaide",
            "Australia/Darwin",
            "Australia/Hobart",
        ),
        stage="prelaunch",
    ),
    "NZ": Market(
        country_code="NZ",
        locale="en-NZ",
        currency="NZD",
        employment_ruleset="nz-employment-law",
        business_identifier="NZBN",
        label="New Zealand",
        region_label="Region",
        phone_prefix="+64",
        time_zones=("Pacific/Auckland", "Pacific/Chatham"),
        stage="preparing",
    ),
}


def list_markets() -> tuple[Market, ...]:
    """Return configured markets without making them transactionally available."""
    return tuple(_MARKETS[key] for key in sorted(_MARKETS))


def market_for(country_code: str) -> Market:
    """Look up an ISO-2 configured market; never silently default to Australia."""
    country_code = country_code.strip().upper()
    market = _MARKETS.get(country_code)
    if market is None:
        raise MarketUnavailable(f"Market {country_code!r} is not configured")
    return market


def require_capability(country_code: str, capability: Capability) -> Market:
    """An informational market entry never enables a transactional feature."""
    market = market_for(country_code)
    if capability not in market.capabilities:
        raise MarketUnavailable(
            f"{capability.value} has not been approved for {market.country_code}"
        )
    return market


def validate_currency(country_code: str, currency: str) -> None:
    """Reject mismatched ISO currency rather than auto-converting AU prices to NZD."""
    market = market_for(country_code)
    if currency.upper() != market.currency:
        raise ValueError(
            f"Currency {currency!r} does not match {market.country_code}; "
            f"expected {market.currency}"
        )


def validate_pay_amount(value: Decimal) -> None:
    """Basic representation check only; NOT a minimum-wage or award assessment."""
    if not value.is_finite() or value < 0:
        raise ValueError("Pay amount must be finite and nonnegative")


def jurisdiction_for_workplace(country_code: str | None) -> Market:
    """No inferred jurisdiction for an unspecified physical workplace."""
    if not country_code:
        raise MarketUnavailable("Workplace country must be verified before assessment")
    return market_for(country_code)
