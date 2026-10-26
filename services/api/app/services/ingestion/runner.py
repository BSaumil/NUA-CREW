import hashlib
import json
import uuid
from datetime import UTC, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import audit
from app.models import (
    IngestionSource,
    Job,
    JobSourceObservation,
    SourceFetchRun,
    SourcePermission,
)
from app.services.ingestion.connector import OPTIONAL_FIELDS, Connector, ParsedJob, build_connector
from app.services.jobs import _coords, record_version, set_job_skills


async def active_permission(
    session: AsyncSession, source: IngestionSource, now: datetime | None = None
) -> SourcePermission | None:
    """Fail closed: only an active source with an unrevoked, in-window grant may be fetched."""
    now = now or datetime.now(UTC)
    if source.status != "active":
        return None
    rows = await session.scalars(
        select(SourcePermission)
        .where(SourcePermission.source_id == source.id, SourcePermission.revoked_at.is_(None))
        .order_by(SourcePermission.created_at.desc())
    )
    for p in rows:
        if p.valid_from <= now and (p.valid_until is None or p.valid_until > now):
            return p
    return None


def _filtered(parsed: ParsedJob, permitted: set[str]) -> dict[str, Any]:
    data = parsed.model_dump()
    for f in OPTIONAL_FIELDS - permitted:
        data[f] = [] if f == "skills" else None
    return data


def _hash(data: dict[str, object]) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


def _apply(job: Job, data: dict[str, Any], attribution: str | None) -> None:
    def dec(v: object) -> Decimal | None:
        try:
            return Decimal(str(v)) if v is not None else None
        except InvalidOperation:
            return None

    pay_min, pay_max = dec(data.get("pay_min")), dec(data.get("pay_max"))
    period = data.get("pay_period") if (pay_min is not None or pay_max is not None) else None
    if (pay_min is not None or pay_max is not None) and period is None:
        pay_min = pay_max = None
    if pay_min is not None and pay_max is not None and pay_min > pay_max:
        pay_min, pay_max = pay_max, pay_min
    job.title = str(data["title"])
    job.description = str(data["description"])
    job.employment_type = str(data["employment_type"])
    job.category = data.get("category") and str(data["category"]) or None
    job.suburb = data.get("suburb") and str(data["suburb"]) or None
    job.state = data.get("state") and str(data["state"]) or None
    job.postcode = data.get("postcode") and str(data["postcode"]) or None
    job.lat, job.lng = _coords(job.suburb, job.state)
    job.pay_min, job.pay_max = pay_min, pay_max
    job.pay_period = str(period) if period else None
    job.pay_basis = "disclosed" if pay_min is not None or pay_max is not None else "not_disclosed"
    job.apply_url = str(data["apply_url"])
    job.source_employer_name = data.get("company") and str(data["company"]) or None
    job.attribution = attribution


async def run_source(
    session: AsyncSession,
    source: IngestionSource,
    actor_id: uuid.UUID | None,
    connector: Connector | None = None,
) -> SourceFetchRun:
    run = SourceFetchRun(source_id=source.id, status="running", stats={})
    session.add(run)
    await session.flush()

    perm = await active_permission(session, source)
    if perm is None:
        run.status, run.error = "rejected", "no_active_permission"
        run.finished_at = datetime.now(UTC)
        await audit(session, actor_id, "ingestion.rejected", "ingestion_source", source.id)
        await session.flush()
        return run

    connector = connector or build_connector(source.kind, source.config)
    if not connector.verify_permission(perm.permitted_fields):
        run.status, run.error = "rejected", "permission_missing_required_fields"
        run.finished_at = datetime.now(UTC)
        await session.flush()
        return run

    permitted = set(perm.permitted_fields)
    stats = {"created": 0, "updated": 0, "unchanged": 0, "invalid": 0, "expired": 0}
    seen: set[str] = set()
    now = datetime.now(UTC)

    for ref in connector.discover():
        try:
            parsed = connector.parse(connector.fetch(ref))
        except (ValidationError, KeyError, ValueError):
            stats["invalid"] += 1  # bad records are skipped, never auto-published
            continue
        seen.add(parsed.external_id)
        data = _filtered(parsed, permitted)
        digest = _hash(data)
        obs = (
            await session.scalars(
                select(JobSourceObservation).where(
                    JobSourceObservation.source_id == source.id,
                    JobSourceObservation.external_id == parsed.external_id,
                )
            )
        ).one_or_none()
        skills = [str(s) for s in data.get("skills", [])]
        if obs is None:
            new_job = Job(
                origin="ingested", status="published", published_at=now, last_verified_at=now
            )
            _apply(new_job, data, perm.attribution)
            session.add(new_job)
            await session.flush()
            await set_job_skills(session, new_job, skills)
            await record_version(session, new_job, skills, actor_id)
            session.add(
                JobSourceObservation(
                    source_id=source.id,
                    external_id=parsed.external_id,
                    job_id=new_job.id,
                    content_hash=digest,
                    raw=data,
                )
            )
            stats["created"] += 1
            continue
        job = await session.get(Job, obs.job_id)
        assert job is not None  # noqa: S101 - FK guarantees it
        obs.last_seen_at = now
        revived = not obs.active
        obs.active = True
        if obs.content_hash != digest or revived:
            _apply(job, data, perm.attribution)
            job.status, job.last_verified_at = "published", now
            if job.published_at is None:
                job.published_at = now
            obs.content_hash, obs.raw = digest, data
            await set_job_skills(session, job, skills)
            await session.flush()
            await record_version(session, job, skills, actor_id)
            stats["updated"] += 1
        else:
            job.last_verified_at = now
            stats["unchanged"] += 1

    if connector.snapshot:
        gone = await session.scalars(
            select(JobSourceObservation).where(
                JobSourceObservation.source_id == source.id, JobSourceObservation.active.is_(True)
            )
        )
        for obs in gone:
            if obs.external_id not in seen:
                obs.active = False
                gone_job = await session.get(Job, obs.job_id)
                if gone_job is not None and gone_job.status == "published":
                    gone_job.status = "expired"
                    stats["expired"] += 1

    run.status, run.stats, run.finished_at = "succeeded", dict(stats), datetime.now(UTC)
    await audit(session, actor_id, "ingestion.run", "ingestion_source", source.id, **stats)
    await session.flush()
    return run


async def takedown_source(
    session: AsyncSession, source: IngestionSource, actor_id: uuid.UUID | None
) -> int:
    """Revoke a source: stop future fetches and unpublish everything it supplied."""
    now = datetime.now(UTC)
    source.status = "revoked"
    for p in await session.scalars(
        select(SourcePermission).where(
            SourcePermission.source_id == source.id, SourcePermission.revoked_at.is_(None)
        )
    ):
        p.revoked_at = now
    count = 0
    for obs in await session.scalars(
        select(JobSourceObservation).where(JobSourceObservation.source_id == source.id)
    ):
        obs.active = False
        taken = await session.get(Job, obs.job_id)
        if taken is not None and taken.status == "published":
            taken.status = "unpublished"
            count += 1
    await audit(
        session, actor_id, "ingestion.takedown", "ingestion_source", source.id, unpublished=count
    )
    await session.flush()
    return count
