"""Public draft pricing information only. No checkout, purchase or entitlement writes."""

from typing import Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.services import pricing
from app.services.pricing import ProductCode

router = APIRouter(prefix="/v1/pricing", tags=["pricing"])


class ProductOut(BaseModel):
    code: ProductCode
    name: str
    amount_minor: int
    duration_hours: int | None
    review_required: bool
    purchasable: Literal[False] = False


class CatalogOut(BaseModel):
    catalog_version: str
    currency: Literal["AUD"] = "AUD"
    status: Literal["draft"] = "draft"
    billing_status: Literal["not_connected"] = "not_connected"
    tax_treatment: Literal["pending_review"] = "pending_review"
    promotion_is_add_on: Literal[True] = True
    automatically_renews: Literal[False] = False
    employee_access: Literal["free"] = "free"
    employee_charging_enabled: Literal[False] = False
    employee_access_scope: Literal["all_australian_states_and_territories"] = (
        "all_australian_states_and_territories"
    )
    billing_enabled: Literal[False] = False
    employee: dict[str, object]
    employer: dict[str, object]
    assumptions: list[str]
    products: list[ProductOut]


@router.get("", response_model=CatalogOut)
async def catalog() -> CatalogOut:
    return CatalogOut.model_validate(pricing.CATALOGUE)


@router.get("/estimate")
async def get_estimate(
    new_ad: bool = False, readvertise: bool = False, promotions: int = Query(0, ge=0, le=10)
) -> dict[str, object]:
    lines = pricing.estimate(new_ad=new_ad, readvertise=readvertise, promotions=promotions)
    return {
        "currency": pricing.CURRENCY,
        "lines": [{"code": x.code, "label": x.label, "cents": x.cents} for x in lines],
        "total_cents": pricing.total_cents(lines),
        "billing_enabled": False,
        "note": "Estimate only. Tax treatment is unresolved and nothing is charged.",
    }
