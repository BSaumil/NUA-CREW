"""Exercise the DB invariant directly, bypassing the API's candidate row lock."""

import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.models import CandidateProfile, Commitment
from tests.conftest import db_as, register_candidate


async def candidate_id(client, tag):
    await register_candidate(client, f"{tag}@nua-crew.example.com")
    async with db_as("system") as session:
        return (await session.scalars(select(CandidateProfile.id))).one()


async def insert(cid, start, end, status="confirmed"):
    async with db_as("system") as session:
        row = Commitment(candidate_id=cid, starts_at=start, ends_at=end, status=status)
        session.add(row)
        await session.commit()


async def test_database_rejects_overlap_but_allows_adjacent_work_and_held_rows(client):
    cid = await candidate_id(client, "exclusion")
    start = datetime(2027, 1, 1, 12, tzinfo=UTC)
    await insert(cid, start, start + timedelta(hours=2))
    with pytest.raises(IntegrityError) as exc:
        await insert(cid, start + timedelta(hours=1), start + timedelta(hours=3))
    assert getattr(exc.value.orig, "sqlstate", None) == "23P01"
    await insert(cid, start + timedelta(hours=2), start + timedelta(hours=3))
    # Existing manual holds may overlap; full booking/hold lifecycle is a separate milestone.
    await insert(cid, start, start + timedelta(hours=1), "held")


async def test_two_connections_cannot_both_confirm_overlapping_work(client):
    cid = await candidate_id(client, "exclusion-race")
    start = datetime(2027, 1, 1, 12, tzinfo=UTC)

    async def attempt():
        try:
            await insert(cid, start, start + timedelta(hours=2))
            return "confirmed"
        except IntegrityError as exc:
            assert getattr(exc.orig, "sqlstate", None) == "23P01"
            return "conflict"

    assert sorted(await asyncio.gather(attempt(), attempt())) == ["confirmed", "conflict"]
