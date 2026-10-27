"""Postgres billing/inventory tests; fixture receipts never contact or charge through Stripe."""

import asyncio
import hashlib
import hmac
import json
import time
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
import stripe
from pydantic import SecretStr
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError

from app.config import get_settings
from app.errors import ApiError
from app.models import (
    AdEntitlement,
    BillingLedger,
    BillingOrder,
    Job,
    PromotionReservation,
    PublishedPromotion,
)
from app.services import stripe_payments as payments
from app.services.billing import prepare_order, record_verified_event, sweep_billing
from app.services.pricing import EstimateAction
from tests.conftest import db_as, published_job, register_employer, verified_employer


async def prepare(eid, jid, key, action=EstimateAction.NEW_PROMOTED_AD):
    async with db_as("system") as s:
        row = await prepare_order(
            s, employer_id=uuid.UUID(eid), job_id=uuid.UUID(jid), action=action, client_key=key
        )
        await s.commit()
        return row.id


async def fixture_receipt(oid, key="fixture-settlement", amount=4900, kind="settled"):
    async with db_as("system") as s:
        row = await record_verified_event(
            s,
            order_id=oid,
            provider="fixture",
            event_key=key,
            amount_minor=amount,
            currency="AUD",
            kind=kind,
        )
        await s.commit()
        return row.status


async def test_capacity_race_expiry_and_late_payment_never_overbook(client):
    emp, eid = await verified_employer(client, "billing-capacity@nua-crew.example.com")
    jobs = [await published_job(client, emp, eid, title=f"Role {n}") for n in range(6)]

    async def attempt(n):
        try:
            return await prepare(eid, jobs[n]["id"], f"capacity-order-{n}")
        except ApiError as exc:
            assert exc.code == "promotion_full"
            return None

    results = await asyncio.gather(*(attempt(n) for n in range(6)))
    assert sum(r is not None for r in results) == 5
    async with db_as("system") as s:
        holds = list(await s.scalars(select(PromotionReservation)))
        assert sorted(h.slot for h in holds) == [1, 2, 3, 4, 5]
        hold = holds[0]
        oid = hold.order_id
        row = await s.get(BillingOrder, oid)
        hold.hold_expires_at = row.expires_at = datetime.now(UTC) - timedelta(minutes=1)
        await s.commit()
    await prepare(eid, jobs[results.index(None)]["id"], "replacement-quote")
    assert await fixture_receipt(oid, "late-payment") == "refund_required"
    async with db_as("system") as s:
        assert (
            await s.scalar(
                select(func.count())
                .select_from(PromotionReservation)
                .where(PromotionReservation.status.in_(["held", "active"]))
            )
            == 5
        )


async def test_prices_idempotent_receipts_refunds_and_immutable_ledger(client):
    emp, eid = await verified_employer(client, "billing-replay@nua-crew.example.com")
    job = await published_job(client, emp, eid)
    oid = await prepare(eid, job["id"], "original-quote")
    assert await prepare(eid, job["id"], "original-quote") == oid
    with pytest.raises(ApiError) as reused:
        await prepare(eid, job["id"], "original-quote", EstimateAction.NEW_AD)
    assert reused.value.code == "retry_key_reused"
    with pytest.raises(ApiError) as wrong:
        await fixture_receipt(oid, amount=1900)
    assert wrong.value.code == "payment_mismatch"
    assert await fixture_receipt(oid) == "settled"
    assert await fixture_receipt(oid) == "settled"
    async with db_as("system") as s:
        assert await s.scalar(select(func.count()).select_from(BillingLedger)) == 1
        ad = (await s.scalars(select(AdEntitlement))).one()
        assert ad.ends_at - ad.starts_at == timedelta(days=14)
        promo = (await s.scalars(select(PromotionReservation))).one()
        assert promo.ends_at - promo.starts_at == timedelta(days=5)
        assert (await s.scalars(select(PublishedPromotion))).one().active
    assert await fixture_receipt(oid, "partial-refund", 1900, "partial_refund") == "settled"
    assert await fixture_receipt(oid, "full-refund", 4900, "refunded") == "refunded"
    async with db_as("system") as s:
        assert not (await s.scalars(select(AdEntitlement))).one().active
        assert not (await s.scalars(select(PublishedPromotion))).one().active
    for sql in ("UPDATE billing_ledger SET amount_minor=1", "DELETE FROM billing_ledger"):
        with pytest.raises(DBAPIError):
            async with db_as("system") as s:
                await s.execute(text(sql))


async def test_renewal_repeat_promotion_and_search_scope(client, monkeypatch):
    emp, eid = await verified_employer(client, "billing-renew@nua-crew.example.com")
    job = await published_job(client, emp, eid)
    oid = await prepare(eid, job["id"], "first-advertisement", EstimateAction.NEW_AD)
    await fixture_receipt(oid, "ad-payment", 1900)
    async with db_as("system") as s:
        original = (await s.get(Job, uuid.UUID(job["id"]))).expires_at
    renewal = await prepare(eid, job["id"], "renew-advertisement", EstimateAction.READVERTISE)
    await fixture_receipt(renewal, "renew-payment", 1900)
    async with db_as("system") as s:
        assert (await s.get(Job, uuid.UUID(job["id"]))).expires_at == original + timedelta(days=14)
    first = await prepare(eid, job["id"], "first-promotion", EstimateAction.PROMOTE_EXISTING)
    await fixture_receipt(first, "first-promo-payment", 3000)
    second = await prepare(eid, job["id"], "second-promotion", EstimateAction.PROMOTE_EXISTING)
    await fixture_receipt(second, "second-promo-payment", 3000)
    async with db_as("system") as s:
        promos = list(
            await s.scalars(select(PromotionReservation).order_by(PromotionReservation.starts_at))
        )
        assert promos[0].ends_at == promos[1].starts_at
    newer = await published_job(client, emp, eid, title="Organic new role")
    monkeypatch.setattr(get_settings(), "paid_advertising_enabled", True)
    scoped = await client.get(
        "/v1/jobs", params={"state": "VIC", "suburb": "Fitzroy", "category": "Hospitality"}
    )
    assert scoped.json()["items"][0]["id"] == job["id"]
    assert scoped.json()["items"][0]["promoted"] is True
    newest = await client.get(
        "/v1/jobs",
        params={"state": "VIC", "suburb": "Fitzroy", "category": "Hospitality", "sort": "newest"},
    )
    assert newest.json()["items"][0]["id"] == newer["id"]
    filtered = await client.get(
        "/v1/jobs",
        params={"state": "VIC", "suburb": "Fitzroy", "category": "Hospitality", "q": "Organic"},
    )
    assert [j["id"] for j in filtered.json()["items"]] == [newer["id"]]


async def test_private_billing_rows_and_public_projection(client):
    emp, eid = await verified_employer(client, "billing-private@nua-crew.example.com")
    _, other_id = await register_employer(client, "billing-other@nua-crew.example.com")
    job = await published_job(client, emp, eid)
    oid = await prepare(eid, job["id"], "private-quote")
    await fixture_receipt(oid)
    for role, context in [
        ("", {}),
        ("candidate", {}),
        ("employer", {"employer_ids": [uuid.UUID(other_id)]}),
    ]:
        async with db_as(role, **context) as s:
            for model in (BillingOrder, PromotionReservation, AdEntitlement, BillingLedger):
                assert await s.scalar(select(func.count()).select_from(model)) == 0
            assert await s.scalar(select(func.count()).select_from(PublishedPromotion)) == 1
    async with db_as("system") as s:
        row = await s.get(BillingOrder, oid)
        row.status, row.expires_at = "pending", datetime.now(UTC) - timedelta(minutes=1)
        await s.commit()
    async with db_as("system") as s:
        assert await sweep_billing(s) == 1


@pytest.fixture
def stripe_transport(monkeypatch):
    settings = get_settings()
    for name, value in {
        "stripe_mode": "test",
        "stripe_secret_key": SecretStr("sk_test_fixture"),
        "stripe_webhook_secret": SecretStr("whsec_fixture"),
        "billing_terms_approved": True,
    }.items():
        monkeypatch.setattr(settings, name, value)
    sessions = {}

    async def create(params, options=None):
        sid = f"cs_test_{uuid.uuid4().hex}"
        sessions[sid] = {
            "id": sid,
            "object": "checkout.session",
            "mode": "payment",
            "livemode": False,
            "amount_total": params["line_items"][0]["price_data"]["unit_amount"],
            "currency": "aud",
            "payment_status": "unpaid",
            "status": "open",
            "payment_intent": None,
            "client_reference_id": params["client_reference_id"],
            "metadata": params["metadata"],
            "url": "https://checkout.stripe.com/c/pay/fixture",
        }
        return stripe.checkout.Session.construct_from(sessions[sid], None)

    async def retrieve(sid):
        return stripe.checkout.Session.construct_from(sessions[sid], None)

    sdk = SimpleNamespace(
        v1=SimpleNamespace(
            checkout=SimpleNamespace(
                sessions=SimpleNamespace(create_async=create, retrieve_async=retrieve)
            )
        )
    )

    @asynccontextmanager
    async def provider():
        yield sdk

    monkeypatch.setattr(payments, "client", provider)

    def event_payload(sid, **changes):
        sessions[sid].update(changes)
        data = {
            "id": "evt_paid_fixture",
            "type": "checkout.session.completed",
            "livemode": False,
            "data": {"object": sessions[sid]},
        }
        raw = json.dumps(data).encode()
        stamp = int(time.time())
        digest = hmac.new(
            b"whsec_fixture", str(stamp).encode() + b"." + raw, hashlib.sha256
        ).hexdigest()
        return raw, f"t={stamp},v1={digest}"

    return sessions, event_payload


async def test_checkout_signed_fulfilment_and_cross_tenant_permissions(client, stripe_transport):
    emp, eid = await verified_employer(client, "stripe-owner@nua-crew.example.com")
    other, _ = await register_employer(client, "stripe-other@nua-crew.example.com")
    job = await published_job(client, emp, eid)
    checkout = f"/v1/employers/{eid}/billing/checkout"
    data = {
        "job_id": job["id"],
        "action": "new_promoted_ad",
        "client_key": "stripe-checkout-fixture",
        "confirm_publish_and_terms": True,
    }
    assert (await client.post(checkout, headers=other, json=data)).status_code == 404
    opened = await client.post(checkout, headers=emp, json=data)
    assert opened.status_code == 200, opened.text
    assert (
        await client.get(f"/v1/employers/{eid}/billing/orders", headers=other)
    ).status_code == 404
    sessions, event_payload = stripe_transport
    sid = next(iter(sessions))
    raw, sig = event_payload(
        sid, payment_status="paid", payment_intent="pi_fixture", status="complete"
    )
    assert (
        await client.post(
            "/v1/billing/stripe/webhook", content=raw, headers={"stripe-signature": "invalid"}
        )
    ).status_code == 400
    for _ in range(2):
        result = await client.post(
            "/v1/billing/stripe/webhook", content=raw, headers={"stripe-signature": sig}
        )
        assert result.status_code == 200, result.text
    orders = (await client.get(f"/v1/employers/{eid}/billing/orders", headers=emp)).json()
    assert orders[0]["status"] == "settled" and orders[0]["amount_minor"] == 4900
    async with db_as("system") as s:
        assert await s.scalar(select(func.count()).select_from(AdEntitlement)) == 1
        assert await s.scalar(select(func.count()).select_from(BillingLedger)) == 1
