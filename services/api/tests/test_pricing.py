from app.services import pricing


async def test_employee_access_is_free_nationally_and_has_no_sku(client):
    body = (await client.get("/v1/pricing")).json()
    emp = body["employee"]
    assert emp["access"] == "free" and emp["charging_enabled"] is False and emp["products"] == []
    assert "Australian states and territories" in emp["scope"]
    assert body["billing_enabled"] is False
    assert "1000" not in str(body) and "A$10" not in str(body)  # no legacy employee price
    assert body["employer"]["auto_renew"] is False
    assert body["employer"]["top_five"]["purchasable"] is False


async def test_employer_estimates_are_19_30_49(client):
    async def total(**q):
        r = await client.get("/v1/pricing/estimate", params=q)
        assert r.json()["billing_enabled"] is False
        return r.json()["total_cents"]

    assert await total(new_ad="true") == 1900
    assert await total(readvertise="true") == 1900
    assert await total(promotions=1) == 3000
    assert await total(new_ad="true", promotions=1) == 4900
    assert await total(promotions=2) == 6000
    assert (await client.get("/v1/pricing/estimate", params={"promotions": -1})).status_code == 422
    assert pricing.total_cents(pricing.estimate()) == 0
