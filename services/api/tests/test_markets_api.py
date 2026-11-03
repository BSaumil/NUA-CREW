"""Public market API contract for web, Android and iOS clients.

These tests deliberately prove that preview status cannot enable transactions.
"""

import httpx
import pytest


@pytest.mark.asyncio
async def test_markets_endpoint_lists_supported_prelaunch_countries(
    client: httpx.AsyncClient,
) -> None:
    response = await client.get("/v1/markets")
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    payload = response.json()
    by_code = {entry["country_code"]: entry for entry in payload}
    assert {"AU", "NZ"} <= set(by_code)

    assert by_code["AU"]["currency"] == "AUD"
    assert by_code["AU"]["locale"] == "en-AU"
    assert by_code["AU"]["employer_identifier_label"] == "ABN"
    assert by_code["AU"]["stage"] == "prelaunch"

    assert by_code["NZ"]["currency"] == "NZD"
    assert by_code["NZ"]["locale"] == "en-NZ"
    assert by_code["NZ"]["employer_identifier_label"] == "NZBN"
    assert by_code["NZ"]["stage"] == "preparing"

    for country in by_code.values():
        assert country["capabilities"] == {
            "onboarding": False,
            "job_publishing": False,
            "shifts": False,
            "billing": False,
        }
        assert country["time_zones"]
        assert country["region_label"]
        assert country["phone_prefix"].startswith("+")


@pytest.mark.asyncio
async def test_markets_endpoint_is_read_only(client: httpx.AsyncClient) -> None:
    for path in ("/v1/markets", "/v1/markets/NZ"):
        response = await client.post(path, json={"stage": "open"})
        assert response.status_code == 405


@pytest.mark.asyncio
async def test_market_detail_unknown_country_fails_closed(client: httpx.AsyncClient) -> None:
    au = await client.get("/v1/markets/au")
    assert au.status_code == 200
    assert au.json()["country_code"] == "AU"
    unknown = await client.get("/v1/markets/ZZ")
    assert unknown.status_code == 404
    assert "not configured" in unknown.json()["detail"]
    assert "AUD" not in unknown.text


@pytest.mark.asyncio
async def test_openapi_exposes_typed_market_contract(client: httpx.AsyncClient) -> None:
    response = await client.get("/openapi.json")
    assert response.status_code == 200
    data = response.json()
    assert "/v1/markets" in data["paths"]
    assert "/v1/markets/{country_code}" in data["paths"]
    capabilities = data["components"]["schemas"]["MarketCapabilitiesOut"]
    for field in ("onboarding", "job_publishing", "shifts", "billing"):
        assert field in capabilities["properties"]
