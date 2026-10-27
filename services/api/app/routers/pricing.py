from fastapi import APIRouter, Query

from app.services import pricing

router = APIRouter(prefix="/v1/pricing", tags=["pricing"])


@router.get("")
async def get_pricing() -> dict[str, object]:
    """Public, informational catalogue. Billing is not enabled; nothing can be purchased."""
    return pricing.CATALOGUE


@router.get("/estimate")
async def get_estimate(
    new_ad: bool = False,
    readvertise: bool = False,
    promotions: int = Query(0, ge=0, le=10),
) -> dict[str, object]:
    lines = pricing.estimate(new_ad=new_ad, readvertise=readvertise, promotions=promotions)
    return {
        "currency": pricing.CURRENCY,
        "lines": [{"code": x.code, "label": x.label, "cents": x.cents} for x in lines],
        "total_cents": pricing.total_cents(lines),
        "billing_enabled": False,
        "note": "Estimate only. Tax treatment is unresolved and nothing is charged.",
    }
