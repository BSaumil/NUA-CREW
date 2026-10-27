"""Pricing catalogue and employer estimates. Informational only: billing is NOT enabled.

Owner decisions (2026-10-27): employee access is free in every state and territory on every
platform; employee charging is a roadmap option with no SKU, paywall or date; employers pay per
advertisement (A$19 for 14 days, re-advertise A$19 for 14 days) with an optional A$30 five-day
promotion treated as an ADD-ON (so a new advertisement plus promotion is A$49 - an assumption the
owner has not yet confirmed); top-five placement is reserved, capacity-limited inventory that is not
for sale yet; nothing renews automatically; tax treatment and channel product setup are unresolved,
so these are estimates, not tax invoices.
"""

from dataclasses import dataclass

CURRENCY = "AUD"
AD_CENTS = 1900
AD_DAYS = 14
PROMOTION_CENTS = 3000
PROMOTION_DAYS = 5


@dataclass(frozen=True)
class Line:
    code: str
    label: str
    cents: int


CATALOGUE = {
    "employee": {
        "access": "free",
        "scope": "All Australian states and territories; Android, iOS and web",
        "charging_enabled": False,
        "products": [],
        "note": (
            "Employee charging is a roadmap option only: no product, paywall, payment prompt or "
            "activation date exists, and free access never depends on employer payment."
        ),
    },
    "employer": {
        "account_fee_cents": None,
        "advertisement": {"cents": AD_CENTS, "days": AD_DAYS},
        "readvertisement": {"cents": AD_CENTS, "days": AD_DAYS, "keeps_history": True},
        "promotion": {"cents": PROMOTION_CENTS, "days": PROMOTION_DAYS, "kind": "add_on"},
        "top_five": {
            "purchasable": False,
            "note": "Reserved, capacity-limited local-category inventory; not on sale.",
        },
        "auto_renew": False,
        "requires_explicit_confirmation": True,
    },
    "billing_enabled": False,
    "currency": CURRENCY,
    "assumptions": [
        "A$30 promotion is an add-on, not an inclusive A$30 premium advertisement (unconfirmed).",
        "Tax treatment (GST) and store/channel product setup are unresolved; these are estimates.",
    ],
}


def estimate(*, new_ad: bool = False, readvertise: bool = False, promotions: int = 0) -> list[Line]:
    """Employer estimate. Each purchase is explicit; nothing here charges anyone."""
    if promotions < 0:
        raise ValueError("promotions must be >= 0")
    lines: list[Line] = []
    if new_ad:
        lines.append(Line("advertisement", f"Advertisement, {AD_DAYS} days", AD_CENTS))
    if readvertise:
        lines.append(Line("readvertisement", f"Re-advertise, {AD_DAYS} days", AD_CENTS))
    for i in range(promotions):
        lines.append(
            Line(f"promotion_{i + 1}", f"Promotion, {PROMOTION_DAYS} days", PROMOTION_CENTS)
        )
    return lines


def total_cents(lines: list[Line]) -> int:
    return sum(x.cents for x in lines)
