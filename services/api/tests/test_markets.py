"""Fail-closed AU/NZ jurisdiction checks; independent of live recruitment routes."""
from decimal import Decimal

import pytest

from app.markets import (
    Capability,
    MarketUnavailable,
    jurisdiction_for_workplace,
    market_for,
    require_capability,
    validate_currency,
    validate_pay_amount,
)


@pytest.mark.parametrize(
    ("country", "currency", "ruleset"),
    [
        ("AU", "AUD", "au-fair-work"),
        ("NZ", "NZD", "nz-employment-law"),
    ],
)
def test_market_registry(country: str, currency: str, ruleset: str) -> None:
    market = market_for(country.lower())
    assert market.currency == currency
    assert market.employment_ruleset == ruleset


@pytest.mark.parametrize("country", ["", "US", "GB", "XX", "NZD"])
def test_unconfigured_country_fails_closed(country: str) -> None:
    with pytest.raises(MarketUnavailable):
        market_for(country)


@pytest.mark.parametrize("country", ["AU", "NZ"])
@pytest.mark.parametrize("capability", list(Capability))
def test_transactional_capabilities_remain_disabled(country: str, capability: Capability) -> None:
    with pytest.raises(MarketUnavailable):
        require_capability(country, capability)


def test_currency_cannot_be_silently_interchanged() -> None:
    validate_currency("AU", "AUD")
    validate_currency("NZ", "NZD")
    with pytest.raises(ValueError):
        validate_currency("NZ", "AUD")
    with pytest.raises(ValueError):
        validate_currency("AU", "NZD")


def test_missing_country_does_not_default_to_au() -> None:
    with pytest.raises(MarketUnavailable):
        jurisdiction_for_workplace(None)
    assert jurisdiction_for_workplace("NZ").country_code == "NZ"


@pytest.mark.parametrize("bad", [Decimal("-1"), Decimal("NaN"), Decimal("Infinity")])
def test_invalid_pay_amounts_fail(bad: Decimal) -> None:
    with pytest.raises(ValueError):
        validate_pay_amount(bad)
