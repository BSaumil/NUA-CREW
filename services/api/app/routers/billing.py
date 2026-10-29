import uuid
from datetime import UTC, datetime
from typing import Literal

import stripe
from fastapi import APIRouter, Request
from pydantic import BaseModel, Field
from sqlalchemy import select, update

from app.audit import audit
from app.deps import CurrentUser, Owner, Session, Viewer, _bind_rls_context
from app.errors import ApiError, conflict, not_found
from app.models import BillingOrder, Job, PromotionReservation
from app.rls import system_scope
from app.services import billing as domain
from app.services import stripe_payments as payments
from app.services.pricing import EstimateAction

router = APIRouter(prefix="/v1", tags=["billing"])


class CheckoutIn(BaseModel):
    job_id: uuid.UUID
    action: EstimateAction
    client_key: str = Field(min_length=8, max_length=80)
    confirm_publish_and_terms: Literal[True]


class CheckoutOut(BaseModel):
    order_id: uuid.UUID
    checkout_url: str
    mode: Literal["test"] = "test"


class RefundIn(BaseModel):
    confirm: Literal[True]


class OrderOut(BaseModel):
    id: uuid.UUID
    job_id: uuid.UUID
    job_title: str
    action: str
    amount_minor: int
    currency: Literal["AUD"] = "AUD"
    status: str
    expires_at: datetime
    refund_requested: bool
    review_required: bool
    promotion_slot: int | None
    promotion_starts_at: datetime | None
    promotion_ends_at: datetime | None


@router.get("/billing/status")
async def billing_status() -> dict[str, object]:
    ready, message = payments.readiness()
    return {
        "provider": "stripe",
        "mode": "test" if ready else "disabled",
        "checkout_enabled": ready,
        "live_charging_enabled": False,
        "employee_charging_enabled": False,
        "channels": ["web"],
        "message": message,
    }


async def own(session: Session, eid: uuid.UUID, oid: uuid.UUID) -> BillingOrder:
    row = await session.scalar(
        select(BillingOrder).where(BillingOrder.id == oid, BillingOrder.employer_id == eid)
    )
    if row is None:
        raise not_found("order")
    return row


@router.get("/employers/{employer_id}/billing/orders", response_model=list[OrderOut])
async def orders(employer_id: uuid.UUID, _: Viewer, session: Session) -> list[OrderOut]:
    rows = (
        await session.execute(
            select(BillingOrder, Job.title)
            .join(Job, Job.id == BillingOrder.job_id)
            .where(BillingOrder.employer_id == employer_id)
            .order_by(BillingOrder.created_at.desc())
            .limit(100)
        )
    ).all()
    result = []
    for order, title in rows:
        hold = await session.scalar(
            select(PromotionReservation).where(PromotionReservation.order_id == order.id)
        )
        result.append(
            OrderOut(
                id=order.id,
                job_id=order.job_id,
                job_title=title,
                action=order.action,
                amount_minor=order.amount_minor,
                status="expired"
                if order.status == "pending" and order.expires_at <= datetime.now(UTC)
                else order.status,
                expires_at=order.expires_at,
                refund_requested=bool(order.refund_id),
                review_required=order.review_required,
                promotion_slot=hold.slot if hold and hold.status != "released" else None,
                promotion_starts_at=hold.starts_at if hold else None,
                promotion_ends_at=hold.ends_at if hold else None,
            )
        )
    return result


@router.post("/employers/{employer_id}/billing/checkout", response_model=CheckoutOut)
async def checkout(
    employer_id: uuid.UUID, body: CheckoutIn, _: Owner, user: CurrentUser, session: Session
) -> CheckoutOut:
    payments.require_ready()
    row = await domain.prepare_order(
        session,
        employer_id=employer_id,
        job_id=body.job_id,
        action=body.action,
        client_key=body.client_key,
    )
    if row.status != "pending":
        raise conflict(
            "order_not_pending", "Check the recorded payment status before starting another order"
        )
    # The order and inventory must be durable before Stripe can create a payable session.
    await session.commit()
    await _bind_rls_context(session, user)
    try:
        url, sid = await payments.create_checkout(row)
    except stripe.StripeError as exc:
        raise ApiError(
            503,
            "stripe_unavailable",
            "Stripe could not open checkout. Retry this same order; nothing is confirmed here.",
        ) from exc
    async with system_scope(session):
        row.checkout_session_id = sid
        await session.flush()
    await audit(session, user.id, "billing.checkout_opened", "billing_order", row.id)
    return CheckoutOut(order_id=row.id, checkout_url=url)


@router.post(
    "/employers/{employer_id}/billing/orders/{order_id}/resume", response_model=CheckoutOut
)
async def resume(
    employer_id: uuid.UUID, order_id: uuid.UUID, _: Owner, user: CurrentUser, session: Session
) -> CheckoutOut:
    payments.require_ready()
    row = await own(session, employer_id, order_id)
    if row.status != "pending" or row.expires_at <= datetime.now(UTC):
        raise conflict("order_not_pending", "This checkout quote is no longer pending")
    try:
        url, sid = await payments.create_checkout(row)
    except stripe.StripeError as exc:
        raise ApiError(
            503,
            "stripe_unavailable",
            "Stripe could not resume checkout. No payment is confirmed here.",
        ) from exc
    async with system_scope(session):
        row.checkout_session_id = sid
    await audit(session, user.id, "billing.checkout_resumed", "billing_order", row.id)
    return CheckoutOut(order_id=row.id, checkout_url=url)


@router.post("/employers/{employer_id}/billing/orders/{order_id}/cancel")
async def cancel_quote(
    employer_id: uuid.UUID,
    order_id: uuid.UUID,
    body: RefundIn,
    _: Owner,
    user: CurrentUser,
    session: Session,
) -> dict[str, str]:
    payments.require_ready()
    row = await own(session, employer_id, order_id)
    if row.status != "pending":
        raise conflict("order_not_pending", "Only an unpaid pending quote can be cancelled")
    if row.checkout_session_id:
        try:
            async with payments.client() as sdk:
                state = await sdk.v1.checkout.sessions.retrieve_async(row.checkout_session_id)
                if state.payment_status == "paid" or state.status == "complete":
                    raise conflict(
                        "payment_processing",
                        "Payment is being confirmed. Reload the order before requesting a refund.",
                    )
                if state.status == "open":
                    await sdk.v1.checkout.sessions.expire_async(row.checkout_session_id)
        except stripe.StripeError as exc:
            raise ApiError(
                503,
                "stripe_unavailable",
                "Stripe could not confirm cancellation. The reservation stays held until expiry.",
            ) from exc
    async with system_scope(session):
        # Recheck after the network call; a concurrent webhook may have settled the order.
        from app.models import Employer

        await session.execute(
            select(Employer.id).where(Employer.id == employer_id).with_for_update()
        )
        await session.refresh(row, with_for_update=True)
        if row.status != "pending":
            raise conflict("payment_processing", "The order changed; reload its latest status")
        row.status = "expired"
        await session.execute(
            update(PromotionReservation)
            .where(PromotionReservation.order_id == row.id, PromotionReservation.status == "held")
            .values(status="released")
        )
    await audit(session, user.id, "billing.quote_cancelled", "billing_order", row.id)
    return {"status": "cancelled"}


@router.post("/employers/{employer_id}/billing/orders/{order_id}/refund")
async def refund(
    employer_id: uuid.UUID,
    order_id: uuid.UUID,
    body: RefundIn,
    _: Owner,
    user: CurrentUser,
    session: Session,
) -> dict[str, str]:
    payments.require_ready()
    row = await own(session, employer_id, order_id)
    if row.status not in {"settled", "refund_required"}:
        raise conflict("refund_unavailable", "Only confirmed payments can be refunded")
    try:
        async with system_scope(session):
            await payments.request_refund(row)
    except stripe.StripeError as exc:
        raise ApiError(
            503, "stripe_unavailable", "Stripe could not confirm the refund request. Retry safely."
        ) from exc
    await audit(session, user.id, "billing.refund_requested", "billing_order", row.id)
    return {
        "status": "refund_requested",
        "message": "Refund requested. Final status follows Stripe confirmation.",
    }


@router.post("/billing/stripe/webhook")
async def webhook(request: Request, session: Session) -> dict[str, bool]:
    payload = bytearray()
    async for chunk in request.stream():
        payload.extend(chunk)
        if len(payload) > 256 * 1024:
            raise ApiError(413, "event_too_large", "Webhook payload is too large")
    event = payments.signed_event(bytes(payload), request.headers.get("stripe-signature"))
    try:
        await payments.receive(session, event)
    except stripe.StripeError as exc:
        raise ApiError(
            503, "stripe_unavailable", "Retry webhook delivery after Stripe is available"
        ) from exc
    return {"received": True}
