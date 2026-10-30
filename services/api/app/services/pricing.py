"""Owner's proposed AUD catalogue. Estimates never grant paid entitlements.

Employee access is free nationally. Future employee monetisation is a roadmap option
only; see docs/ACCOUNT_BILLING_PLAN.md. No payment or activation adapter is connected.
"""

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from enum import StrEnum

CATALOG_VERSION = "2026-10-27-draft-2"


class ProductCode(StrEnum):
    JOB_AD = "job_ad_14_days"
    PROMOTION = "promotion_5_days"


@dataclass(frozen=True)
class Product:
    code: ProductCode
    name: str
    amount_minor: int
    duration_hours: int
    review_required: bool = False


PRODUCTS = (
    Product(ProductCode.JOB_AD, "Job advertisement — 14 days", 1900, 14 * 24),
    Product(ProductCode.PROMOTION, "Promoted placement — 5 days", 3000, 5 * 24),
)


class EstimateAction(StrEnum):
    NEW_AD = "new_ad"
    READVERTISE = "readvertise"
    NEW_PROMOTED_AD = "new_promoted_ad"
    PROMOTE_EXISTING = "promote_existing"


@dataclass(frozen=True)
class PriceEstimate:
    catalog_version: str
    currency: str
    products: tuple[Product, ...]
    total_minor: int
    tax_treatment: str = "pending_review"
    purchasable: bool = False


def estimate_action(action: EstimateAction) -> PriceEstimate:
    """No quantities, arbitrary amounts or client-supplied discounts are accepted.

    Promotion is proposed as an ADD-ON, not a $30 inclusive listing tier. GST treatment
    must be approved before these draft totals become checkout prices.
    """
    codes: tuple[ProductCode, ...]
    match action:
        case EstimateAction.NEW_AD | EstimateAction.READVERTISE:
            codes = (ProductCode.JOB_AD,)
        case EstimateAction.NEW_PROMOTED_AD:
            codes = (ProductCode.JOB_AD, ProductCode.PROMOTION)
        case EstimateAction.PROMOTE_EXISTING:
            codes = (ProductCode.PROMOTION,)
        case _:
            raise ValueError("Unknown pricing action")
    lines = tuple(product for code in codes for product in PRODUCTS if product.code == code)
    return PriceEstimate(CATALOG_VERSION, "AUD", lines, sum(p.amount_minor for p in lines))


def service_window(start: datetime, product_code: ProductCode) -> tuple[datetime, datetime]:
    """Proposed elapsed-hour window [start, end); no entitlement is persisted.

    Start is supplied only by the eventual trusted publication/reservation service,
    after moderation and verified payment, never by a checkout client.
    """
    if start.tzinfo is None or start.utcoffset() is None:
        raise ValueError("A timezone-aware start is required")
    product = next(p for p in PRODUCTS if p.code == product_code)
    instant = start.astimezone(UTC)
    return instant, instant + timedelta(hours=product.duration_hours)


def promotion_window(start: datetime, listing_expires_at: datetime) -> tuple[datetime, datetime]:
    """Reject a partial five-day boost rather than silently shortening a paid service."""
    if listing_expires_at.tzinfo is None or listing_expires_at.utcoffset() is None:
        raise ValueError("A timezone-aware listing expiry is required")
    window = service_window(start, ProductCode.PROMOTION)
    if window[1] > listing_expires_at.astimezone(UTC):
        raise ValueError("Renew listing coverage before booking a full five-day promotion")
    return window


CURRENCY = "AUD"
AD_CENTS = PRODUCTS[0].amount_minor
AD_DAYS = PRODUCTS[0].duration_hours // 24
PROMOTION_CENTS = PRODUCTS[1].amount_minor
PROMOTION_DAYS = PRODUCTS[1].duration_hours // 24


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


CATALOGUE.update(
    {
        "catalog_version": CATALOG_VERSION,
        "status": "draft",
        "billing_status": "not_connected",
        "tax_treatment": "pending_review",
        "promotion_is_add_on": True,
        "automatically_renews": False,
        "employee_access": "free",
        "employee_charging_enabled": False,
        "employee_access_scope": "all_australian_states_and_territories",
        "products": [
            {
                "code": p.code,
                "name": p.name,
                "amount_minor": p.amount_minor,
                "duration_hours": p.duration_hours,
                "review_required": p.review_required,
                "purchasable": False,
            }
            for p in PRODUCTS
        ],
    }
)
