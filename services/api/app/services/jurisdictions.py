"""Employment jurisdiction boundaries for AU and future country adapters.

A country code is not legal evidence. NZ and any additional market remain disabled
for transactional routes until verified rules, billing and privacy gates are implemented.
No reliance on request IP, user nationality, or an inferred pay currency.
"""

import re
from dataclasses import dataclass

from app.errors import ApiError

_CODE = re.compile(r"^[A-Z]{2}$")


@dataclass(frozen=True)
class Jurisdiction:
    code: str
    currency: str
    pay_ruleset: str
    publish_enabled: bool
    shift_enabled: bool


JURISDICTIONS: dict[str, Jurisdiction] = {
    "AU": Jurisdiction("AU", "AUD", "au-fair-work", True, True),
    "NZ": Jurisdiction("NZ", "NZD", "nz-employment-law", False, False),
}


_AU_STATES = frozenset({"ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"})


def verified_workplace_country(
    country: str | None, state: str | None, postcode: str | None
) -> str | None:
    """The workplace country, only when the venue itself corroborates it.

    ``locations.country`` carries a historical ``AU`` default, so on its own it is not evidence.
    A venue counts as Australian only when its state is an Australian state or territory and its
    postcode has the Australian four-digit form; anything else is unresolved and the regulated
    action fails closed. Other countries stay unresolved until their own venue evidence exists.
    """
    code = normalise_country_code(country)
    if (
        code == "AU"
        and state in _AU_STATES
        and postcode is not None
        and re.fullmatch(r"\d{4}", postcode)
    ):
        return "AU"
    return None


def normalise_country_code(value: str | None) -> str | None:
    """Treat missing classifications as unresolved, not as New Zealand or Australia."""
    if value is None:
        return None
    code = value.strip().upper()
    if not _CODE.fullmatch(code):
        raise ApiError(422, "invalid_country_code", "Use an ISO two-letter country code")
    return code


def jurisdiction_for(code: str | None) -> Jurisdiction | None:
    country = normalise_country_code(code)
    return JURISDICTIONS.get(country) if country is not None else None


def require_market_capability(country: str | None, *, action: str) -> Jurisdiction:
    """Fail closed for unknown/unreviewed countries or missing workplace evidence."""
    market = jurisdiction_for(country)
    if market is None or not (
        (action == "publish" and market.publish_enabled)
        or (action == "shift" and market.shift_enabled)
    ):
        raise ApiError(
            422,
            "market_not_enabled",
            "This workplace jurisdiction is not enabled for this action",
        )
    return market


def require_job_currency(country: str | None, currency: str) -> None:
    market = jurisdiction_for(country)
    if market is None or currency != market.currency:
        raise ApiError(
            422, "jurisdiction_currency_mismatch", "Job currency must match its workplace"
        )
