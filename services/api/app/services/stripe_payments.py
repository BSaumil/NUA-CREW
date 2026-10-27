"""Stripe test-mode adapter. Secrets and signed receipts stay on the server."""

import uuid
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any, cast
from urllib.parse import urlencode, urlsplit

import stripe
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from stripe.params.checkout import SessionCreateParams

from app.config import get_settings
from app.errors import ApiError, conflict, not_found
from app.models import BillingOrder, PromotionReservation
from app.rls import system_scope
from app.services.billing import record_verified_event


def readiness() -> tuple[bool, str]:
    s = get_settings()
    if s.stripe_mode != "test" or not s.stripe_secret_key or not s.stripe_webhook_secret:
        return False, "Stripe is not connected. No payments are available."
    if not s.stripe_secret_key.get_secret_value().startswith(("sk_test_", "rk_test_")):
        return False, "Only Stripe test-mode credentials are supported."
    if not s.billing_terms_approved:
        return False, "Advertising terms and tax display must be reviewed before checkout."
    url = urlsplit(s.billing_return_url)
    local_dev = s.env == "development" and url.hostname in {"localhost", "127.0.0.1"}
    if (url.scheme != "https" and not local_dev) or not url.hostname or url.query or url.fragment:
        return False, "Configure the approved employer billing return URL."
    if url.hostname.endswith(".invalid"):
        return False, "Replace the placeholder billing return URL."
    return True, "Stripe sandbox only. Test cards never charge real money."


def require_ready() -> None:
    ready, message = readiness()
    if not ready:
        raise ApiError(503, "billing_not_connected", message)


@asynccontextmanager
async def client() -> AsyncIterator[stripe.StripeClient]:
    require_ready()
    secret = get_settings().stripe_secret_key
    assert secret is not None
    # Stripe's transport currently leaves lifecycle methods untyped; keep that boundary here.
    transport: Any = stripe.HTTPXClient(timeout=15)
    try:
        yield stripe.StripeClient(
            secret.get_secret_value(), http_client=transport, max_network_retries=2
        )
    finally:
        await transport.close_async()


async def create_checkout(order: BillingOrder) -> tuple[str, str]:
    async with client() as sdk:
        if order.checkout_session_id:
            session = await sdk.v1.checkout.sessions.retrieve_async(order.checkout_session_id)
        else:
            if (order.expires_at - datetime.now(UTC)).total_seconds() < 30 * 60 + 10:
                raise conflict(
                    "quote_expired", "Start a new checkout quote; this one is too old to open"
                )
            query = urlencode({"order": str(order.id)})
            base = get_settings().billing_return_url
            params: SessionCreateParams = {
                "mode": "payment",
                "allowed_payment_method_types": ["card"],
                "client_reference_id": str(order.id),
                "expires_at": int(order.expires_at.timestamp()),
                "metadata": {"order_id": str(order.id), "integration": "nua-crew-web-v1"},
                "payment_intent_data": {"metadata": {"order_id": str(order.id)}},
                "success_url": f"{base}?{query}&checkout=returned",
                "cancel_url": f"{base}?{query}&checkout=cancelled",
                "line_items": [
                    {
                        "quantity": 1,
                        "price_data": {
                            "currency": "aud",
                            "unit_amount": order.amount_minor,
                            "product_data": {"name": f"NUA CREW advertising · {order.action}"},
                        },
                    }
                ],
            }
            session = await sdk.v1.checkout.sessions.create_async(
                params, options={"idempotency_key": f"nua-checkout:{order.id}"}
            )
        if (
            session.livemode
            or not session.url
            or not session.url.startswith("https://checkout.stripe.com/")
        ):
            raise ApiError(
                502, "checkout_unavailable", "Stripe did not return a valid sandbox checkout"
            )
        return session.url, session.id


def signed_event(payload: bytes, signature: str | None) -> dict[str, Any]:
    require_ready()
    secret = get_settings().stripe_webhook_secret
    assert secret is not None
    try:
        event = stripe.Webhook.construct_event(
            payload, signature, secret.get_secret_value(), tolerance=300
        )
    except (ValueError, stripe.SignatureVerificationError) as exc:
        raise ApiError(400, "invalid_signature", "Invalid Stripe webhook") from exc
    decoded = cast(dict[str, Any], event.to_dict())
    if decoded.get("livemode") is not False:
        raise ApiError(400, "live_event_refused", "Live payments are not enabled")
    return decoded


async def bind_session(session: AsyncSession, obj: Any) -> BillingOrder:
    if isinstance(obj, stripe.StripeObject):
        obj = obj.to_dict()
    if not isinstance(obj, dict):
        raise ApiError(400, "invalid_checkout", "Invalid checkout payload")
    try:
        oid = uuid.UUID(str(obj.get("client_reference_id")))
    except (ValueError, AttributeError) as exc:
        raise ApiError(400, "invalid_checkout", "Checkout has no valid order reference") from exc
    row = await session.get(BillingOrder, oid)
    if row is None:
        raise not_found("order")
    # All billing operations take the employer lock before the order/job/inventory locks.
    from app.models import Employer

    await session.execute(
        select(Employer.id).where(Employer.id == row.employer_id).with_for_update()
    )
    await session.refresh(row, with_for_update=True)
    metadata = obj.get("metadata") or {}
    if (
        obj.get("livemode") is not False
        or obj.get("mode") != "payment"
        or obj.get("amount_total") != row.amount_minor
        or obj.get("currency") != "aud"
        or metadata.get("order_id") != str(row.id)
        or metadata.get("integration") != "nua-crew-web-v1"
    ):
        raise conflict("payment_mismatch", "Checkout does not match the server order")
    sid = str(obj.get("id", ""))
    if not sid.startswith("cs_test_") or (
        row.checkout_session_id and row.checkout_session_id != sid
    ):
        raise conflict("checkout_mismatch", "Checkout session does not match the order")
    pi = obj.get("payment_intent")
    if isinstance(pi, dict):
        pi = pi.get("id")
    if pi and row.payment_intent_id and row.payment_intent_id != pi:
        raise conflict("payment_mismatch", "PaymentIntent does not match the order")
    row.checkout_session_id = sid
    if pi:
        row.payment_intent_id = str(pi)
    return row


async def receive(session: AsyncSession, event: dict[str, Any]) -> None:
    kind = event.get("type")
    if kind not in {
        "checkout.session.completed",
        "checkout.session.async_payment_succeeded",
        "checkout.session.expired",
        "charge.refunded",
        "refund.updated",
        "refund.failed",
    }:
        return
    event_id = str(event.get("id", ""))
    if not event_id.startswith("evt_"):
        raise ApiError(400, "invalid_event", "Invalid Stripe event identifier")
    obj = event.get("data", {}).get("object", {})
    async with system_scope(session):
        from app.services.billing import _market_lock

        await _market_lock(session, f"stripe-event:stripe:{event_id}")
        if kind in {"charge.refunded", "refund.updated", "refund.failed"}:
            pi = obj.get("payment_intent")
            if not isinstance(pi, str):
                raise ApiError(400, "invalid_refund", "Refund has no PaymentIntent")
            row = await session.scalar(
                select(BillingOrder).where(BillingOrder.payment_intent_id == pi)
            )
            if row is None:
                # Stripe does not guarantee event order: reconcile via the authenticated API.
                async with client() as sdk:
                    sessions = await sdk.v1.checkout.sessions.list_async(
                        {"payment_intent": pi, "limit": 1}
                    )
                if not sessions.data:
                    raise ApiError(
                        409, "refund_not_bound", "Retry after the checkout session is available"
                    )
                row = await bind_session(session, sessions.data[0])
            if kind != "charge.refunded":
                if obj.get("status") in {"failed", "canceled"} or kind == "refund.failed":
                    row.review_required = True
                    return
                if obj.get("status") != "succeeded":
                    return
            refunded = (
                obj.get("amount_refunded") if kind == "charge.refunded" else obj.get("amount")
            )
            if (
                not isinstance(refunded, int)
                or not 0 < refunded <= row.amount_minor
                or (kind == "charge.refunded" and obj.get("amount") != row.amount_minor)
                or obj.get("currency") != "aud"
            ):
                raise conflict("refund_mismatch", "Refund does not match the order")
            await record_verified_event(
                session,
                order_id=row.id,
                provider="stripe",
                event_key=event_id,
                amount_minor=refunded,
                currency="AUD",
                kind="refunded" if refunded == row.amount_minor else "partial_refund",
            )
            return
        row = await bind_session(session, obj)
        if kind == "checkout.session.expired":
            if row.status == "pending":
                row.status = "expired"
                await session.execute(
                    update(PromotionReservation)
                    .where(
                        PromotionReservation.order_id == row.id,
                        PromotionReservation.status == "held",
                    )
                    .values(status="released")
                )
            return
        if obj.get("payment_status") != "paid":
            return
        # Retrieve current payment state from Stripe as well as verifying the event signature.
        async with client() as sdk:
            current = await sdk.v1.checkout.sessions.retrieve_async(str(obj["id"]))
        await bind_session(session, current)
        if current.payment_status != "paid":
            return
        await record_verified_event(
            session,
            order_id=row.id,
            provider="stripe",
            event_key=event_id,
            amount_minor=row.amount_minor,
            currency="AUD",
            kind="settled",
        )


async def request_refund(order: BillingOrder) -> str:
    if not order.payment_intent_id:
        raise conflict("payment_pending", "The payment is not yet confirmed")
    async with client() as sdk:
        refund = await sdk.v1.refunds.create_async(
            {
                "payment_intent": order.payment_intent_id,
                "reason": "requested_by_customer",
                "metadata": {"order_id": str(order.id)},
            },
            options={"idempotency_key": f"nua-full-refund:{order.id}"},
        )
    order.refund_id = refund.id
    if refund.status in {"failed", "canceled"}:
        order.review_required = True
    return refund.id


async def refund_unfulfilled(session: AsyncSession) -> int:
    """Compensate paid orders that could not be fulfilled; never run without connected test mode."""
    if not readiness()[0]:
        return 0
    requested = 0
    async with system_scope(session):
        rows = list(
            await session.scalars(
                select(BillingOrder)
                .where(
                    BillingOrder.status == "refund_required",
                    BillingOrder.refund_id.is_(None),
                    BillingOrder.payment_intent_id.is_not(None),
                    ~BillingOrder.review_required,
                )
                .limit(10)
            )
        )
        for row in rows:
            try:
                await request_refund(row)
                requested += 1
            except stripe.StripeError:
                # The same idempotency key is used on a future worker pass. No false refund result.
                continue
    return requested
