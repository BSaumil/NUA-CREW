"""Run without a database: uv run python -m pytest unit_tests --confcutdir=unit_tests."""

from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

import httpx
import pytest

from app.main import create_app
from app.services.pricing import (
    EstimateAction,
    ProductCode,
    promotion_window,
    service_window,
)
from app.services.pricing import (
    estimate_action as estimate,
)


@pytest.mark.parametrize(
    ("action", "total", "lines"),
    [
        (EstimateAction.NEW_AD, 1900, 1),
        (EstimateAction.READVERTISE, 1900, 1),
        (EstimateAction.NEW_PROMOTED_AD, 4900, 2),
        (EstimateAction.PROMOTE_EXISTING, 3000, 1),
    ],
)
def test_prices_are_draft_aud_and_do_not_grant_access(action, total, lines):
    result = estimate(action)
    assert result.currency == "AUD"
    assert result.total_minor == total
    assert len(result.products) == lines
    assert result.purchasable is False
    assert result.tax_treatment == "pending_review"


@pytest.mark.parametrize("start", [datetime(2026, 10, 2, 12), datetime(2027, 4, 2, 12)])
def test_window_preserves_elapsed_duration_across_melbourne_dst(start):
    local = start.replace(tzinfo=ZoneInfo("Australia/Melbourne"))
    begin, end = service_window(local, ProductCode.JOB_AD)
    assert end - begin == timedelta(hours=336)
    assert begin == local.astimezone(UTC)
    assert end.tzinfo is UTC
    assert end.astimezone(local.tzinfo).hour != local.hour


def test_promotion_may_end_exactly_at_listing_expiry():
    start = datetime(2026, 11, 1, tzinfo=UTC)
    assert promotion_window(start, start + timedelta(days=5))[1] == start + timedelta(days=5)


def test_short_listing_cannot_sell_full_price_partial_promotion():
    start = datetime(2026, 11, 1, tzinfo=UTC)
    with pytest.raises(ValueError, match="Renew listing coverage"):
        promotion_window(start, start + timedelta(days=5) - timedelta(microseconds=1))


def test_expired_listing_cannot_be_promoted():
    start = datetime(2026, 11, 1, tzinfo=UTC)
    with pytest.raises(ValueError, match="Renew listing coverage"):
        promotion_window(start, start - timedelta(seconds=1))


def test_naive_dates_are_rejected():
    with pytest.raises(ValueError, match="timezone-aware"):
        service_window(datetime(2026, 11, 1), ProductCode.JOB_AD)
    with pytest.raises(ValueError, match="timezone-aware"):
        promotion_window(datetime(2026, 11, 1, tzinfo=UTC), datetime(2026, 11, 7))


def test_employee_fee_has_no_catalog_product():
    assert "employee_access_once" not in {p.value for p in ProductCode}


def test_old_employee_fee_action_cannot_be_estimated():
    with pytest.raises(ValueError):
        EstimateAction("employee_access")


@pytest.mark.asyncio
async def test_draft_catalog_is_readable_without_database_or_payment_credentials():
    async with httpx.AsyncClient(
        transport=httpx.ASGITransport(app=create_app()), base_url="http://test"
    ) as client:
        response = await client.get("/v1/pricing")
        assert response.status_code == 200
        body = response.json()
        assert body["billing_status"] == "not_connected"
        assert body["promotion_is_add_on"] is True
        assert body["automatically_renews"] is False
        assert body["employee_access"] == "free"
        assert body["employee_charging_enabled"] is False
        assert body["employee_access_scope"] == "all_australian_states_and_territories"
        assert [p["amount_minor"] for p in body["products"]] == [1900, 3000]
        assert all(p["purchasable"] is False for p in body["products"])
        assert (await client.post("/v1/pricing")).status_code == 405
