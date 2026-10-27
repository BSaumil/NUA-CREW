"""Billing domain, not checkout. No HTTP endpoint can settle an order.

A future real provider adapter must verify signatures/receipts before calling settle/refund.
No provider adapter, card form, live mode, fabricated checkout or signed test gateway exists.
Inventory is custom marketplace logic and does not depend on the eventual store/PSP choice.
"""

import hashlib
import json
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import audit
from app.errors import conflict, forbidden, not_found
from app.models import (
    AdEntitlement,
    BillingLedger,
    BillingOrder,
    Employer,
    Job,
    JobSkill,
    PromotionReservation,
    PublishedPromotion,
    Skill,
)
from app.rls import system_scope
from app.services.jobs import record_version
from app.services.pricing import EstimateAction, estimate_action


def terms_hash(job: Job) -> str:
    fields = (
        "title",
        "description",
        "location_id",
        "category",
        "suburb",
        "state",
        "pay_min",
        "pay_max",
        "pay_period",
        "pay_currency",
        "pay_basis",
        "super_included",
        "engagement_basis",
        "duration_type",
        "hours_pattern",
        "start_date",
        "end_date",
    )
    return hashlib.sha256(
        json.dumps({k: str(getattr(job, k)) for k in fields}, sort_keys=True).encode()
    ).hexdigest()


def market_for(job: Job) -> str:
    if not job.state or not job.suburb or not job.category:
        raise conflict(
            "promotion_market", "Add the job state, suburb and category before promotion"
        )
    # Length prefixes avoid collisions when source values contain separators.
    parts = [v.strip().casefold() for v in (job.state, job.suburb, job.category)]
    return "".join(f"{len(v)}:{v}" for v in parts)


async def _market_lock(session: AsyncSession, market: str) -> None:
    await session.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:market, 0))"), {"market": market}
    )


async def prepare_order(
    session: AsyncSession,
    *,
    employer_id: uuid.UUID,
    job_id: uuid.UUID,
    action: EstimateAction,
    client_key: str,
) -> BillingOrder:
    """Internal domain operation. A caller must already authorise the employer's owner.

    Does not charge or publish. Holds cover a 35-minute Stripe Checkout session.
    """
    if not 8 <= len(client_key) <= 80:
        raise ValueError("Use a stable order retry key of 8–80 characters")
    async with system_scope(session):
        employer = await session.scalar(
            select(Employer).where(Employer.id == employer_id).with_for_update()
        )
        if employer is None:
            raise not_found("employer")
        existing = await session.scalar(
            select(BillingOrder).where(
                BillingOrder.employer_id == employer_id, BillingOrder.client_key == client_key
            )
        )
        if existing:
            if existing.job_id != job_id or existing.action != action:
                raise conflict("retry_key_reused", "That retry key belongs to a different order")
            return existing
        if employer.verification_status != "verified":
            raise forbidden("Business verification is required")
        job = await session.scalar(
            select(Job).where(Job.id == job_id, Job.employer_id == employer_id).with_for_update()
        )
        if job is None:
            raise not_found("job")
        if job.status == "closed":
            raise conflict("job_closed", "Create a new advertisement for a closed role")
        if not job.suburb or job.pay_basis != "disclosed" or job.super_included is None:
            raise conflict(
                "job_not_ready", "Review the venue, disclosed pay and super before checkout"
            )
        now = datetime.now(UTC)
        pending_order = await session.scalar(
            select(BillingOrder.id)
            .where(
                BillingOrder.job_id == job_id,
                BillingOrder.status == "pending",
                BillingOrder.expires_at > now,
            )
            .limit(1)
        )
        if pending_order:
            raise conflict(
                "checkout_pending", "Resume or cancel the existing checkout for this job"
            )
        price = estimate_action(action)
        order = BillingOrder(
            employer_id=employer_id,
            job_id=job_id,
            action=action,
            amount_minor=price.total_minor,
            client_key=client_key,
            terms_hash=terms_hash(job),
            status="pending",
            expires_at=now + timedelta(minutes=35),
        )
        session.add(order)
        await session.flush()
        if action in (EstimateAction.NEW_PROMOTED_AD, EstimateAction.PROMOTE_EXISTING):
            market = market_for(job)
            await _market_lock(session, market)
            await session.execute(
                update(PromotionReservation)
                .where(
                    PromotionReservation.market == market,
                    PromotionReservation.status == "held",
                    PromotionReservation.hold_expires_at <= now,
                )
                .values(status="released")
            )
            # Re-promotion queues after existing paid coverage; a second pending quote is refused.
            pending = await session.scalar(
                select(PromotionReservation.id)
                .where(PromotionReservation.job_id == job.id, PromotionReservation.status == "held")
                .limit(1)
            )
            if pending:
                raise conflict(
                    "promotion_pending", "Complete or let the existing promotion quote expire"
                )
            last = await session.scalar(
                select(func.max(PromotionReservation.ends_at)).where(
                    PromotionReservation.job_id == job.id, PromotionReservation.status == "active"
                )
            )
            starts = max(now, last) if last else now
            reserve_end = max(starts, order.expires_at) + timedelta(days=5)
            if action == EstimateAction.PROMOTE_EXISTING and (
                job.status != "published" or job.expires_at is None or job.expires_at < reserve_end
            ):
                raise conflict(
                    "listing_coverage",
                    "Renew the advertisement before reserving a full five-day promotion",
                )
            occupied = set(
                await session.scalars(
                    select(PromotionReservation.slot).where(
                        PromotionReservation.market == market,
                        PromotionReservation.status.in_(["held", "active"]),
                        PromotionReservation.starts_at < reserve_end,
                        PromotionReservation.ends_at > starts,
                    )
                )
            )
            slot = next((n for n in range(1, 6) if n not in occupied), None)
            if slot is None:
                raise conflict(
                    "promotion_full",
                    "All five local-category placements are reserved for that period",
                )
            session.add(
                PromotionReservation(
                    order_id=order.id,
                    employer_id=employer_id,
                    job_id=job_id,
                    market=market,
                    slot=slot,
                    starts_at=starts,
                    ends_at=reserve_end,
                    hold_expires_at=order.expires_at,
                    status="held",
                )
            )
    return order


async def record_verified_event(
    session: AsyncSession,
    *,
    order_id: uuid.UUID,
    provider: str,
    event_key: str,
    amount_minor: int,
    currency: str,
    kind: str,
) -> BillingOrder:
    """Trusted adapter boundary, intentionally not exposed by any router.

    Tests exercise persistence with fixture events. This does NOT verify a provider signature:
    callers must do so using the selected provider before invoking it. Partial refunds and tax
    invoices need provider-specific accounting and are not silently treated as full refunds.
    """
    if (
        not provider
        or len(provider) > 40
        or not event_key
        or len(event_key) > 200
        or kind not in {"settled", "refunded", "partial_refund"}
    ):
        raise ValueError("Invalid provider event")
    fingerprint = hashlib.sha256(
        f"{order_id}|{amount_minor}|{currency}|{kind}".encode()
    ).hexdigest()
    async with system_scope(session):
        await _market_lock(session, f"stripe-event:{provider}:{event_key}")
        order = await session.get(BillingOrder, order_id)
        if order is None:
            raise not_found("order")
        await session.execute(
            select(Employer.id).where(Employer.id == order.employer_id).with_for_update()
        )
        await session.refresh(order, with_for_update=True)
        event = await session.scalar(
            select(BillingLedger).where(
                BillingLedger.provider == provider, BillingLedger.event_key == event_key
            )
        )
        if event:
            if event.fingerprint != fingerprint or event.order_id != order_id:
                raise conflict(
                    "event_reused", "The provider event does not match its original payload"
                )
            return order
        valid_amount = (
            (0 < amount_minor < order.amount_minor)
            if kind == "partial_refund"
            else amount_minor == order.amount_minor
        )
        if currency != "AUD" or not valid_amount:
            raise conflict("payment_mismatch", "The event amount and currency must match the order")
        reservation = await session.scalar(
            select(PromotionReservation).where(PromotionReservation.order_id == order.id)
        )
        if reservation:
            await _market_lock(session, reservation.market)
        now = datetime.now(UTC)
        job = await session.scalar(select(Job).where(Job.id == order.job_id).with_for_update())
        employer = await session.get(Employer, order.employer_id)
        assert job is not None and employer is not None
        session.add(
            BillingLedger(
                order_id=order.id,
                employer_id=order.employer_id,
                provider=provider,
                event_key=event_key,
                fingerprint=fingerprint,
                event_kind=kind,
                amount_minor=amount_minor,
            )
        )
        if kind == "partial_refund":
            order.review_required = True
        elif kind == "refunded":
            had_ad = await session.scalar(
                select(AdEntitlement.id).where(AdEntitlement.order_id == order.id)
            )
            order.status = "refunded"
            await session.execute(
                update(AdEntitlement).where(AdEntitlement.order_id == order.id).values(active=False)
            )
            if reservation:
                reservation.status = "released"
                await session.execute(
                    update(PublishedPromotion)
                    .where(PublishedPromotion.id == reservation.id)
                    .values(active=False)
                )
            if had_ad:
                windows = list(
                    await session.scalars(
                        select(AdEntitlement)
                        .where(
                            AdEntitlement.job_id == job.id,
                            AdEntitlement.active,
                            AdEntitlement.ends_at > now,
                        )
                        .order_by(AdEntitlement.starts_at)
                    )
                )
                coverage = now
                for window in windows:
                    if window.starts_at > coverage:
                        duration = window.ends_at - window.starts_at
                        window.starts_at, window.ends_at = coverage, coverage + duration
                    coverage = max(coverage, window.ends_at)
                job.expires_at = coverage
                # A refunded ad must not strand paid promotions beyond remaining coverage.
                related = list(
                    await session.scalars(
                        select(PromotionReservation).where(
                            PromotionReservation.job_id == job.id,
                            PromotionReservation.status.in_(["held", "active"]),
                            PromotionReservation.ends_at > coverage,
                        )
                    )
                )
                for hold in related:
                    await _market_lock(session, hold.market)
                    hold.status = "released"
                    await session.execute(
                        update(PublishedPromotion)
                        .where(PublishedPromotion.id == hold.id)
                        .values(active=False)
                    )
                    dependent = await session.get(BillingOrder, hold.order_id)
                    if dependent and dependent.id != order.id:
                        dependent.status = (
                            "refund_required" if dependent.status == "settled" else "expired"
                        )
        elif order.status in {"settled", "refunded", "refund_required"}:
            # Checkout completed and asynchronous-success events may describe the same payment.
            # The Stripe adapter binds the exact session/PaymentIntent before reaching this point.
            return order
        elif (
            order.expires_at <= now
            or (
                reservation and (reservation.status != "held" or reservation.hold_expires_at <= now)
            )
            or employer.verification_status != "verified"
            or job.status == "closed"
            or order.terms_hash != terms_hash(job)
        ):
            order.status = "refund_required"
            if reservation:
                reservation.status = "released"
        else:
            if order.action != EstimateAction.PROMOTE_EXISTING:
                paid_until = await session.scalar(
                    select(func.max(AdEntitlement.ends_at)).where(
                        AdEntitlement.job_id == job.id, AdEntitlement.active
                    )
                )
                start = max(now, paid_until) if paid_until else now
                end = start + timedelta(days=14)
                session.add(
                    AdEntitlement(
                        order_id=order.id,
                        employer_id=order.employer_id,
                        job_id=job.id,
                        starts_at=start,
                        ends_at=end,
                        active=True,
                    )
                )
                job.expires_at = end
            if reservation:
                reservation.starts_at = max(reservation.starts_at, now)
                reservation.ends_at = reservation.starts_at + timedelta(days=5)
                reservation.status = "active"
                session.add(
                    PublishedPromotion(
                        id=reservation.id,
                        job_id=job.id,
                        market=reservation.market,
                        slot=reservation.slot,
                        starts_at=reservation.starts_at,
                        ends_at=reservation.ends_at,
                        active=True,
                    )
                )
            order.status = "settled"
            if order.action != EstimateAction.PROMOTE_EXISTING:
                job.status = "published"
                job.published_at = job.published_at or now
                job.last_verified_at = now
                skills = list(
                    await session.scalars(
                        select(Skill.name)
                        .join(JobSkill, JobSkill.skill_id == Skill.id)
                        .where(JobSkill.job_id == job.id)
                    )
                )
                await record_version(session, job, skills, None)
        await audit(session, None, f"billing.{kind}", "billing_order", order.id, provider=provider)
    return order


async def sweep_billing(session: AsyncSession) -> int:
    """Release unpaid inventory and expire paid direct ads; called by the existing worker."""
    now = datetime.now(UTC)
    async with system_scope(session):
        result = await session.execute(
            update(BillingOrder)
            .where(BillingOrder.status == "pending", BillingOrder.expires_at <= now)
            .values(status="expired")
            .returning(BillingOrder.id)
        )
        expired = len(result.all())
        await session.execute(
            update(PromotionReservation)
            .where(
                PromotionReservation.status == "held", PromotionReservation.hold_expires_at <= now
            )
            .values(status="released")
        )
        await session.execute(
            update(Job)
            .where(
                Job.origin == "direct",
                Job.status == "published",
                Job.expires_at <= now,
                Job.id.in_(select(AdEntitlement.job_id)),
            )
            .values(status="expired")
        )
    return expired
