"""Stores pay assessments and enforces them when a job is published."""

import hashlib
import json
import uuid
from datetime import date, datetime
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError, conflict, not_found
from app.hospitality_schemas import PayAssessmentIn, PayAssessmentResult
from app.models import HospitalityRole, Job, PayAssessment, PayAssessmentAcknowledgement
from app.services.hospitality.awards import STATE_ZONES, assess
from app.services.hospitality.rules import load_ruleset

AWARDS = {"MA000119", "MA000009", "MA000003", "MA000058"}
JOB_TO_EMPLOYMENT = {
    "casual": "casual",
    "shift": "casual",
    "full_time": "full_time",
    "part_time": "part_time",
}


def input_hash(inp: PayAssessmentIn) -> str:
    payload = inp.model_dump(mode="json", exclude={"job_id", "effective_on"})
    return hashlib.sha256(json.dumps(payload, sort_keys=True).encode()).hexdigest()


def today_in(state: str) -> date:
    return datetime.now(ZoneInfo(STATE_ZONES[state])).date()


async def evaluate(session: AsyncSession, inp: PayAssessmentIn, on: date) -> PayAssessmentResult:
    role_review = False
    if inp.role_code:
        role = await session.get(HospitalityRole, inp.role_code)
        if role is None:
            raise not_found("hospitality role")
        role_review = role.needs_review
    rules = (
        await load_ruleset(session, inp.instrument, on, inp.state)
        if inp.instrument in AWARDS
        else None
    )
    return assess(inp, rules, effective_on=on, role_needs_review=role_review)


async def run_assessment(
    session: AsyncSession,
    employer_id: uuid.UUID,
    user_id: uuid.UUID | None,
    inp: PayAssessmentIn,
    *,
    on: date | None = None,
) -> tuple[PayAssessment, PayAssessmentResult]:
    effective = on or inp.effective_on or today_in(inp.state)
    result = await evaluate(session, inp, effective)
    row = PayAssessment(
        employer_id=employer_id,
        job_id=inp.job_id,
        created_by=user_id,
        effective_on=effective,
        status=result.status,
        input_hash=input_hash(inp),
        input=inp.model_dump(mode="json"),
        result=result.model_dump(mode="json"),
    )
    session.add(row)
    await session.flush()
    return row, result


async def acknowledged(session: AsyncSession, employer_id: uuid.UUID, digest: str) -> bool:
    found = await session.scalar(
        select(PayAssessmentAcknowledgement.id)
        .join(PayAssessment, PayAssessment.id == PayAssessmentAcknowledgement.assessment_id)
        .where(
            PayAssessmentAcknowledgement.employer_id == employer_id,
            PayAssessment.input_hash == digest,
        )
        .limit(1)
    )
    return found is not None


def _stale(job: Job, stored: dict[str, object]) -> str | None:
    """Why the stored assessment no longer describes this job's advertised pay, if it doesn't."""
    if job.pay_period != "hour" or stored.get("pay_period") != "hour":
        return "The pay check must use an hourly rate that matches the advertisement."
    if job.pay_min is None or Decimal(str(stored.get("pay_amount"))) != job.pay_min:
        return "The advertised minimum pay changed after the pay check."
    wanted = JOB_TO_EMPLOYMENT.get(job.employment_type)
    if wanted is None or stored.get("employment") != wanted:
        return "The employment type changed after the pay check."
    return None


async def enforce_on_publish(
    session: AsyncSession, job: Job, user_id: uuid.UUID
) -> PayAssessmentResult | None:
    """Server-side gate. Jobs built with a hospitality role must carry a current pay check."""
    if job.role_code is None or job.pay_basis != "disclosed":
        return None
    if job.pay_assessment_id is None:
        raise conflict(
            "pay_assessment_required", "Run the pay check for this role before publishing"
        )
    stored = await session.get(PayAssessment, job.pay_assessment_id)
    if stored is None or stored.employer_id != job.employer_id:
        raise conflict(
            "pay_assessment_required", "Run the pay check for this role before publishing"
        )
    reason = _stale(job, stored.input)
    if reason:
        raise conflict("pay_assessment_stale", reason + " Run the pay check again.")
    inp = PayAssessmentIn.model_validate({**stored.input, "job_id": job.id, "effective_on": None})
    # Re-assess against today's rules: a rate change can make an older check invalid, while the
    # earlier assessment row stays as the audit record of what was true when it was made.
    assert job.employer_id is not None  # noqa: S101 - role-built jobs are always direct
    row, result = await run_assessment(session, job.employer_id, user_id, inp)
    job.pay_assessment_id = row.id
    if result.status == "below_minimum":
        blocking = " ".join(c.text for c in result.checks if c.level == "block")
        raise ApiError(
            422,
            "below_award_minimum",
            "The advertised pay is below the award minimum. Raise the rate before publishing. "
            + blocking,
        )
    if result.needs_acknowledgement and not await acknowledged(
        session, job.employer_id, row.input_hash
    ):
        raise conflict(
            "pay_review_required",
            "This pay needs a manual review. Acknowledge the review to publish.",
        )
    return result
