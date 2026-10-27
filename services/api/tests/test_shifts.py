import asyncio
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, text

from app.models import Commitment, Shift
from tests.conftest import db_as, register_candidate, register_employer
from tests.test_availability_api import discoverable_candidate, search
from tests.test_invitations import accept, body, send, setup_pair


async def setup(client, tag="shift"):
    emp, eid, job, cand, ref = await setup_pair(client, tag)
    invitation = await send(client, emp, eid, body(ref, job))
    conv = (await accept(client, cand, invitation.json()["id"])).json()["conversation_id"]
    day = (datetime.now(UTC) + timedelta(days=10)).date().isoformat()
    created = await client.post(
        f"/v1/employers/{eid}/shifts",
        headers=emp,
        json={
            "job_id": job["id"],
            "local_date": day,
            "local_start": "09:00",
            "local_end": "13:00",
            "time_zone": "Australia/Melbourne",
            "capacity": 1,
            "hourly_rate_minor": 3000,
        },
    )
    assert created.status_code == 201, created.text
    sid = created.json()["id"]
    offered = await client.post(
        f"/v1/employers/{eid}/shifts/{sid}/offers", headers=emp, json={"conversation_id": conv}
    )
    assert offered.status_code == 201, offered.text
    return emp, eid, job, cand, sid, offered.json()["id"]


async def respond(client, cand, bid, action="accept", **extra):
    return await client.post(
        f"/v1/candidate/shift-bookings/{bid}/respond",
        headers=cand,
        json={"action": action, **extra},
    )


async def test_offer_never_reserves_until_accepted_and_calendar_is_managed(client):
    emp, eid, _, cand, _, bid = await setup(client)
    calendar = await client.get("/v1/candidate/availability", headers=cand)
    assert calendar.json()["commitments"] == []
    accepted = await respond(client, cand, bid)
    assert accepted.status_code == 200 and accepted.json()["status"] == "confirmed", accepted.text
    assert (await respond(client, cand, bid)).status_code == 200  # safe retry
    calendar = (await client.get("/v1/candidate/availability", headers=cand)).json()
    assert len(calendar["commitments"]) == 1
    commitment = calendar["commitments"][0]
    removed = await client.delete(
        f"/v1/candidate/availability/commitments/{commitment['id']}", headers=cand
    )
    assert removed.status_code == 409 and removed.json()["error"]["code"] == "managed_commitment"
    cancelled = await respond(client, cand, bid, "cancel", reason="Plans changed")
    assert cancelled.json()["status"] == "cancelled"
    assert (await client.get("/v1/candidate/availability", headers=cand)).json()[
        "commitments"
    ] == []
    business = (await client.get(f"/v1/employers/{eid}/shift-bookings", headers=emp)).json()
    assert business[0]["reason"] == "Plans changed"
    assert "candidate_id" not in str(business)


async def test_confirmed_work_conflict_returns_no_partial_booking(client):
    _, _, _, cand, _, bid = await setup(client, "shift-conflict")
    offered = (await client.get("/v1/candidate/shift-bookings", headers=cand)).json()[0]
    result = await client.post(
        "/v1/candidate/availability/commitments",
        headers=cand,
        json={
            "starts_at": offered["shift"]["starts_at"],
            "ends_at": offered["shift"]["ends_at"],
            "status": "confirmed",
        },
    )
    assert result.status_code == 201
    conflict = await respond(client, cand, bid)
    assert conflict.status_code == 409 and conflict.json()["error"]["code"] == "commitment_conflict"
    assert (await client.get("/v1/candidate/shift-bookings", headers=cand)).json()[0][
        "status"
    ] == "offered"


async def test_two_people_cannot_accept_the_last_shift_place(client):
    emp, eid, job, first, sid, bid = await setup(client, "shift-capacity")
    second = await discoverable_candidate(
        client,
        "shift-second@nua-crew.example.com",
        "Second Worker",
        ("temporary",),
        suburb="UniqueSecond",
    )
    found = (await search(client, emp, eid, kind="temporary", suburb="UniqueSecond")).json()[
        "items"
    ]
    invitation = await send(client, emp, eid, body(found[0]["ref"], job))
    conv = (await accept(client, second, invitation.json()["id"])).json()["conversation_id"]
    offered = await client.post(
        f"/v1/employers/{eid}/shifts/{sid}/offers", headers=emp, json={"conversation_id": conv}
    )
    assert offered.status_code == 201, offered.text
    results = await asyncio.gather(
        respond(client, first, bid), respond(client, second, offered.json()["id"])
    )
    assert sorted(r.status_code for r in results) == [200, 409]
    assert next(r for r in results if r.status_code == 409).json()["error"]["code"] == "shift_full"
    bookings = (await client.get(f"/v1/employers/{eid}/shift-bookings", headers=emp)).json()
    assert sum(b["status"] == "confirmed" for b in bookings) == 1


async def test_tenant_candidate_and_viewer_boundaries(client):
    emp, eid, _, cand, sid, bid = await setup(client, "shift-isolation")
    other, _ = await register_employer(client, "shift-other@nua-crew.example.com")
    worker = await register_candidate(client, "shift-other-worker@nua-crew.example.com")
    assert (
        await client.get(f"/v1/employers/{eid}/shift-bookings", headers=other)
    ).status_code == 404
    assert (await respond(client, worker, bid)).status_code == 404
    added = await client.post(
        f"/v1/employers/{eid}/members",
        headers=emp,
        json={"email": "shift-other@nua-crew.example.com", "role": "viewer"},
    )
    assert added.status_code == 201
    assert (
        await client.post(
            f"/v1/employers/{eid}/shifts/{sid}/cancel",
            headers=other,
            json={"reason": "Cannot work"},
        )
    ).status_code == 403
    cid = (await client.get("/v1/candidate/profile", headers=cand)).json()["id"]
    other_id = (await client.get("/v1/candidate/profile", headers=worker)).json()["id"]
    for sql in (
        "SELECT count(*) FROM shifts",
        "SELECT count(*) FROM shift_bookings",
        "SELECT count(*) FROM shift_timesheets",
    ):
        async with db_as("candidate", candidate_id=uuid.UUID(other_id)) as session:
            assert await session.scalar(text(sql)) == 0
    async with db_as("candidate", candidate_id=uuid.UUID(cid)) as session:
        assert await session.scalar(text("SELECT count(*) FROM shift_bookings")) == 1


async def test_business_cancellation_releases_confirmed_work(client):
    emp, eid, _, cand, sid, bid = await setup(client, "shift-cancel")
    assert (await respond(client, cand, bid)).status_code == 200
    cancelled = await client.post(
        f"/v1/employers/{eid}/shifts/{sid}/cancel", headers=emp, json={"reason": "Venue closed"}
    )
    assert cancelled.status_code == 200, cancelled.text
    assert (await client.get("/v1/candidate/availability", headers=cand)).json()[
        "commitments"
    ] == []
    assert (await respond(client, cand, bid)).status_code == 409


async def test_timesheet_revision_review_and_approved_immutability(client):
    emp, eid, _, cand, sid, bid = await setup(client, "shift-sheet")
    assert (await respond(client, cand, bid)).status_code == 200
    now = datetime.now(UTC).replace(second=0, microsecond=0)
    start, end = now - timedelta(hours=5), now - timedelta(hours=1)
    async with db_as("system") as session:
        shift = await session.get(Shift, uuid.UUID(sid))
        shift.starts_at, shift.ends_at = start, end
        commitment = (await session.scalars(select(Commitment))).one()
        commitment.starts_at, commitment.ends_at = start, end
        await session.commit()
    payload = {"starts_at": start.isoformat(), "ends_at": end.isoformat(), "break_minutes": 30}
    url = f"/v1/candidate/shift-bookings/{bid}/timesheet"
    submitted = await client.put(url, headers=cand, json=payload)
    assert submitted.status_code == 200, submitted.text
    assert submitted.json()["timesheet"]["worked_minutes"] == 210
    review = f"/v1/employers/{eid}/shift-bookings/{bid}/timesheet-review"
    disputed = await client.post(
        review,
        headers=emp,
        json={"decision": "disputed", "reason": "Please check break", "expected_version": 1},
    )
    assert disputed.json()["timesheet"]["status"] == "disputed"
    assert (await client.put(url, headers=cand, json={**payload, "break_minutes": 15})).json()[
        "timesheet"
    ]["version"] == 2
    stale = await client.post(
        review,
        headers=emp,
        json={"decision": "approved", "reason": "Looks correct", "expected_version": 1},
    )
    assert stale.status_code == 409
    approved = await client.post(
        review,
        headers=emp,
        json={"decision": "approved", "reason": "Looks correct", "expected_version": 2},
    )
    assert approved.json()["timesheet"]["status"] == "approved"
    assert (await client.put(url, headers=cand, json=payload)).status_code == 409
