"""Country-specific employment boundary. NZ remains disabled pending verified rules."""
from dataclasses import dataclass

from app.errors import ApiError


@dataclass(frozen=True)
class MarketRule:
    code: str
    currency: str
    locale: str
    ruleset: str
    publish_enabled: bool


MARKET_RULES: dict[str, MarketRule] = {
    "AU": MarketRule("AU", "AUD", "en-AU", "au-fair-work", True),
    "NZ": MarketRule("NZ", "NZD", "en-NZ", "nz-employment-law", False),
}


def market_for_country(code: str | None) -> MarketRule | None:
    if code is None:
        return None
    return MARKET_RULES.get(code.upper())


def assert_job_market_ready(code: str | None, currency: str) -> MarketRule:
    """Unresolved jurisdiction, mismatched currency or disabled markets cannot transact."""
    market = market_for_country(code)
    if market is None or not market.publish_enabled:
        raise ApiError(
            422,
            "market_not_ready",
            "The job's workplace jurisdiction is unresolved or not open for hiring",
        )
    if currency != market.currency:
        raise ApiError(
            422, "market_currency_mismatch", "Job currency differs from the workplace currency"
        )
    return market


def assess_nz_pay(*_: object, **__: object) -> None:
    """Intentionally NOT a rate calculator; block until a reviewed NZ provider exists."""
    raise ApiError(422, "nz_pay_not_assessed", "New Zealand wage assessment is not yet enabled")
