"""Jurisdiction gates must fail closed independently of website country preferences."""

import pytest

from app.errors import ApiError
from app.services.jurisdictions import (
    jurisdiction_for,
    normalise_country_code,
    require_job_currency,
    require_market_capability,
)


def test_country_code_normalisation_is_explicit() -> None:
    assert normalise_country_code(None) is None
    assert normalise_country_code(" nz ") == "NZ"
    assert normalise_country_code("au") == "AU"
    for bad in ("", "A", "AUS", "U1", "A U", "nz;delete"):
        with pytest.raises(ApiError) as exc:
            normalise_country_code(bad)
        assert exc.value.code == "invalid_country_code"


def test_nonconfigured_country_never_opens_workflows() -> None:
    assert jurisdiction_for("GB") is None
    assert jurisdiction_for("NZ") is not None
    for country in (None, "NZ", "GB"):
        for action in ("publish", "shift"):
            with pytest.raises(ApiError) as exc:
                require_market_capability(country, action=action)
            assert exc.value.code == "market_not_enabled"


def test_australian_capabilities_do_not_authorise_new_zealand_rules() -> None:
    assert require_market_capability("AU", action="publish").currency == "AUD"
    assert require_market_capability("AU", action="shift").pay_ruleset == "au-fair-work"
    require_job_currency("AU", "AUD")
    require_job_currency("NZ", "NZD")
    for country, currency in (("AU", "NZD"), ("NZ", "AUD"), (None, "AUD"), ("GB", "GBP")):
        with pytest.raises(ApiError) as exc:
            require_job_currency(country, currency)
        assert exc.value.code == "jurisdiction_currency_mismatch"
    with pytest.raises(ApiError):
        require_market_capability("AU", action="future")


def test_legacy_must_be_explicitly_proven_if_ever_enabled() -> None:
    with pytest.raises(ApiError):
        require_market_capability(None, action="publish")
    # This exception is AU-only and must never be exposed as a public input.
    assert (
        require_market_capability(None, action="publish", legacy_au_record=True).code == "AU"
    )
