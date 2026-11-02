"""Public, read-only market information. Never an authorisation endpoint."""

from fastapi import APIRouter, HTTPException

from app.markets import Capability, Market, MarketUnavailable, list_markets, market_for
from app.schemas import MarketCapabilitiesOut, MarketPublicOut

router = APIRouter(prefix="/v1/markets", tags=["markets"])


def _present(market: Market) -> MarketPublicOut:
    """Map capability flags explicitly to avoid leaking internal configuration."""
    return MarketPublicOut(
        country_code=market.country_code,
        label=market.label,
        locale=market.locale,
        currency=market.currency,
        region_label=market.region_label,
        employer_identifier_label=market.business_identifier,
        phone_prefix=market.phone_prefix,
        time_zones=list(market.time_zones),
        stage=market.stage,  # type: ignore[arg-type]
        capabilities=MarketCapabilitiesOut(
            onboarding=Capability.ONBOARDING in market.capabilities,
            job_publishing=Capability.JOB_PUBLISHING in market.capabilities,
            shifts=Capability.SHIFTS in market.capabilities,
            billing=Capability.BILLING in market.capabilities,
        ),
    )


@router.get("", response_model=list[MarketPublicOut])
async def get_markets() -> list[MarketPublicOut]:
    """Informational country catalogue; public transactions are not implied."""
    return [_present(market) for market in list_markets()]


@router.get("/{country_code}", response_model=MarketPublicOut)
async def get_market(country_code: str) -> MarketPublicOut:
    """Unknown countries produce 404, not a default Australian market."""
    try:
        market = market_for(country_code)
    except MarketUnavailable as exc:
        raise HTTPException(status_code=404, detail="Market is not configured") from exc
    return _present(market)
