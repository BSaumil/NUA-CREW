import hashlib
import hmac
import json
import time
import uuid
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock

import pytest
from pydantic import SecretStr, ValidationError

from app.config import Settings, get_settings
from app.errors import ApiError
from app.models import BillingOrder
from app.services import stripe_payments as payments


@pytest.fixture
def stripe_test_settings(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "stripe_mode", "test")
    monkeypatch.setattr(s, "stripe_secret_key", SecretStr("sk_test_local_fixture"))
    monkeypatch.setattr(s, "stripe_webhook_secret", SecretStr("whsec_local_fixture"))
    monkeypatch.setattr(s, "billing_terms_approved", True)
    monkeypatch.setattr(s, "billing_return_url", "http://localhost:3001/billing")
    return s


def signature(payload: bytes, stamp: int | None = None) -> str:
    stamp = stamp if stamp is not None else int(time.time())
    digest = hmac.new(
        b"whsec_local_fixture", str(stamp).encode() + b"." + payload, hashlib.sha256
    ).hexdigest()
    return f"t={stamp},v1={digest}"


def test_disabled_without_credentials_and_live_keys_refused():
    assert payments.readiness()[0] is False
    with pytest.raises(ValidationError, match="test keys"):
        Settings.model_validate(
            {"stripe_mode": "test", "stripe_secret_key": "sk_live_never_accepted"}
        )


def test_real_stripe_signature_verification_accepts_fresh_test_event(stripe_test_settings):
    payload = json.dumps(
        {"id": "evt_fixture", "type": "test.event", "livemode": False, "data": {"object": {}}}
    ).encode()
    assert payments.signed_event(payload, signature(payload))["id"] == "evt_fixture"
    for sig in ("t=1,v1=wrong", signature(payload, int(time.time()) - 600), None):
        with pytest.raises(ApiError) as exc:
            payments.signed_event(payload, sig)
        assert exc.value.code == "invalid_signature"


def test_even_a_correctly_signed_live_event_is_refused(stripe_test_settings):
    payload = json.dumps({"id": "evt_live", "type": "test.event", "livemode": True}).encode()
    with pytest.raises(ApiError) as exc:
        payments.signed_event(payload, signature(payload))
    assert exc.value.code == "live_event_refused"


def test_terms_and_callback_configuration_gate_checkout(stripe_test_settings, monkeypatch):
    assert payments.readiness()[0]
    monkeypatch.setattr(stripe_test_settings, "billing_terms_approved", False)
    assert not payments.readiness()[0]
    monkeypatch.setattr(stripe_test_settings, "billing_terms_approved", True)
    monkeypatch.setattr(
        stripe_test_settings, "billing_return_url", "https://staging.invalid/billing"
    )
    assert not payments.readiness()[0]


@pytest.mark.asyncio
async def test_checkout_uses_server_amount_stable_key_and_fixed_return_urls(
    stripe_test_settings, monkeypatch
):
    create = AsyncMock(
        return_value=SimpleNamespace(
            livemode=False, url="https://checkout.stripe.com/c/pay/fixture", id="cs_test_fixture"
        )
    )
    sdk = SimpleNamespace(
        v1=SimpleNamespace(checkout=SimpleNamespace(sessions=SimpleNamespace(create_async=create)))
    )

    @asynccontextmanager
    async def provider():
        yield sdk

    monkeypatch.setattr(payments, "client", provider)
    row = BillingOrder(
        id=uuid.uuid4(),
        amount_minor=1900,
        action="new_ad",
        checkout_session_id=None,
        expires_at=datetime.now(UTC) + timedelta(minutes=35),
    )
    result = await payments.create_checkout(row)
    assert result[1] == "cs_test_fixture"
    params = create.call_args.args[0]
    assert params["line_items"][0]["price_data"]["unit_amount"] == 1900
    assert params["allowed_payment_method_types"] == ["card"]
    assert params["metadata"]["order_id"] == str(row.id)
    assert params["success_url"].startswith("http://localhost:3001/billing?order=")
    assert create.call_args.kwargs["options"]["idempotency_key"] == f"nua-checkout:{row.id}"


@pytest.mark.asyncio
async def test_failed_refund_is_flagged_for_review(monkeypatch):
    create = AsyncMock(return_value=SimpleNamespace(id="re_failed_fixture", status="failed"))
    sdk = SimpleNamespace(v1=SimpleNamespace(refunds=SimpleNamespace(create_async=create)))

    @asynccontextmanager
    async def provider():
        yield sdk

    monkeypatch.setattr(payments, "client", provider)
    row = BillingOrder(id=uuid.uuid4(), payment_intent_id="pi_fixture", review_required=False)
    await payments.request_refund(row)
    assert row.refund_id == "re_failed_fixture" and row.review_required
    assert create.call_args.kwargs["options"]["idempotency_key"] == f"nua-full-refund:{row.id}"
