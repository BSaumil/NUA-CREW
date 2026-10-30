import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.models import Commitment, Notification, Shift
from tests.conftest import db_as, register_candidate, register_employer
from tests.test_shifts import respond, setup


async def move_shift(sid: str, start: datetime, end: datetime) -> None:
    async with db_as("system") as session:
        shift = await session.get(Shift, uuid.UUID(sid))
        shift.starts_at, shift.ends_at = start, end
        for commitment in await session.scalars(select(Commitment)):
            commitment.starts_at, commitment.ends_at = start, end
        await session.commit()


async def live(client, tag, started_minutes_ago=10, length_minutes=180):
    emp, eid, _, cand, sid, bid = await setup(client, tag)
    assert (await respond(client, cand, bid)).status_code == 200
    now = datetime.now(UTC).replace(microsecond=0)
    start = now - timedelta(minutes=started_minutes_ago)
    await move_shift(sid, start, start + timedelta(minutes=length_minutes))
    return emp, eid, cand, sid, bid, start


def cand_url(bid, tail):
    return f"/v1/candidate/shift-bookings/{bid}/{tail}"


def emp_url(eid, bid, tail):
    return f"/v1/employers/{eid}/shift-bookings/{bid}/{tail}"


async def test_check_in_out_is_timestamped_idempotent_and_ordered(client):
    _, eid, cand, _, bid, _ = await live(client, "att-basic")
    early = await client.post(cand_url(bid, "check-out"), headers=cand)
    assert early.status_code == 409 and early.json()["error"]["code"] == "not_checked_in"
    first = await client.post(cand_url(bid, "check-in"), headers=cand)
    assert first.status_code == 200, first.text
    attendance = first.json()["attendance"]
    assert attendance["status"] == "checked_in" and attendance["check_in_at"]
    assert attendance["venue_time_zone"] == "Australia/Melbourne"
    again = await client.post(cand_url(bid, "check-in"), headers=cand)  # safe retry
    assert again.json()["attendance"]["check_in_at"] == attendance["check_in_at"]
    assert len(again.json()["attendance"]["events"]) == 1
    out = await client.post(cand_url(bid, "check-out"), headers=cand)
    assert out.json()["attendance"]["status"] == "checked_out"
    assert [e["kind"] for e in out.json()["attendance"]["events"]] == ["check_in", "check_out"]


async def test_check_in_window_and_unconfirmed_bookings(client):
    emp, eid, _, cand, sid, bid = await setup(client, "att-window")
    # Offered, not accepted: no attendance.
    assert (await client.post(cand_url(bid, "check-in"), headers=cand)).status_code == 409
    assert (await respond(client, cand, bid)).status_code == 200
    # Ten days away: check-in is closed.
    closed = await client.post(cand_url(bid, "check-in"), headers=cand)
    assert closed.status_code == 409 and closed.json()["error"]["code"] == "check_in_window"


async def test_correction_needs_approval_and_never_edits_the_original(client):
    emp, eid, cand, _, bid, start = await live(client, "att-correct")
    assert (await client.post(cand_url(bid, "check-in"), headers=cand)).status_code == 200
    original = (await client.get("/v1/candidate/shift-bookings", headers=cand)).json()[0][
        "attendance"
    ]["check_in_at"]
    claimed = (start - timedelta(minutes=5)).isoformat()
    body = {"claim_kind": "check_in", "claimed_at": claimed, "reason": "Arrived before the app"}
    request = await client.post(cand_url(bid, "attendance-corrections"), headers=cand, json=body)
    assert request.status_code == 200, request.text
    assert request.json()["attendance"]["pending_corrections"] == 1
    assert request.json()["attendance"]["check_in_at"] == original  # unchanged until approved
    duplicate = await client.post(cand_url(bid, "attendance-corrections"), headers=cand, json=body)
    assert duplicate.status_code == 409
    event = next(
        e for e in request.json()["attendance"]["events"] if e["kind"] == "correction_requested"
    )
    review = emp_url(eid, bid, f"attendance-corrections/{event['id']}/review")
    decided = await client.post(
        review, headers=emp, json={"decision": "approved", "reason": "Confirmed on site"}
    )
    assert decided.status_code == 200, decided.text
    attendance = decided.json()["attendance"]
    assert attendance["pending_corrections"] == 0
    assert datetime.fromisoformat(attendance["check_in_at"]) == datetime.fromisoformat(claimed)
    kinds = [e["kind"] for e in attendance["events"]]
    assert kinds == ["check_in", "correction_requested", "correction_approved"]
    assert [e for e in attendance["events"] if e["kind"] == "check_in"][0]["recorded_at"]
    redo = await client.post(
        review, headers=emp, json={"decision": "rejected", "reason": "Changed my mind"}
    )
    assert redo.status_code == 409 and redo.json()["error"]["code"] == "correction_decided"


async def test_correction_order_future_and_rejection(client):
    emp, eid, cand, _, bid, start = await live(client, "att-order")
    future = (datetime.now(UTC) + timedelta(hours=1)).isoformat()
    assert (
        await client.post(
            cand_url(bid, "attendance-corrections"),
            headers=cand,
            json={"claim_kind": "check_in", "claimed_at": future, "reason": "Later"},
        )
    ).status_code == 409
    naive = await client.post(
        cand_url(bid, "attendance-corrections"),
        headers=cand,
        json={"claim_kind": "check_in", "claimed_at": "2026-01-01T09:00:00", "reason": "No zone"},
    )
    assert naive.status_code == 422
    stray = await client.post(
        cand_url(bid, "attendance-corrections"),
        headers=cand,
        json={
            "claim_kind": "check_out",
            "claimed_at": (start + timedelta(minutes=5)).isoformat(),
            "reason": "Left early",
        },
    )
    assert stray.status_code == 409 and stray.json()["error"]["code"] == "correction_order"
    ok = await client.post(
        cand_url(bid, "attendance-corrections"),
        headers=cand,
        json={
            "claim_kind": "check_in",
            "claimed_at": (start + timedelta(minutes=1)).isoformat(),
            "reason": "Forgot to tap",
        },
    )
    event = next(
        e for e in ok.json()["attendance"]["events"] if e["kind"] == "correction_requested"
    )
    rejected = await client.post(
        emp_url(eid, bid, f"attendance-corrections/{event['id']}/review"),
        headers=emp,
        json={"decision": "rejected", "reason": "Not on the roster"},
    )
    assert rejected.json()["attendance"]["status"] == "not_started"
    assert rejected.json()["attendance"]["check_in_at"] is None
    notes = []
    async with db_as("system") as session:
        notes = list(await session.scalars(select(Notification.kind)))
    assert "attendance.correction_requested" in notes and "attendance.correction_reviewed" in notes


async def test_no_show_flow_has_recovery_and_blocks_hours_until_reversed(client):
    emp, eid, cand, _, bid, start = await live(client, "att-noshow", started_minutes_ago=10)
    early = await client.post(emp_url(eid, bid, "no-show"), headers=emp, json={"reason": "Absent"})
    assert early.status_code == 409 and early.json()["error"]["code"] == "too_early"
    # Move the shift so the grace period has passed.
    sid = (await client.get("/v1/candidate/shift-bookings", headers=cand)).json()[0]["shift"]["id"]
    now = datetime.now(UTC).replace(microsecond=0)
    await move_shift(sid, now - timedelta(minutes=45), now + timedelta(hours=2))
    marked = await client.post(
        emp_url(eid, bid, "no-show"), headers=emp, json={"reason": "Did not arrive"}
    )
    assert marked.status_code == 200, marked.text
    assert marked.json()["attendance"]["status"] == "no_show"
    assert (
        await client.post(emp_url(eid, bid, "no-show"), headers=emp, json={"reason": "Again"})
    ).status_code == 409
    blocked = await client.post(cand_url(bid, "check-in"), headers=cand)
    assert blocked.status_code == 409 and blocked.json()["error"]["code"] == "marked_no_show"
    # The candidate can contest; approval of a check-in correction also lifts the mark.
    claim = await client.post(
        cand_url(bid, "attendance-corrections"),
        headers=cand,
        json={
            "claim_kind": "check_in",
            "claimed_at": (now - timedelta(minutes=40)).isoformat(),
            "reason": "I was there at the back door",
        },
    )
    assert claim.status_code == 200, claim.text
    event = next(
        e for e in claim.json()["attendance"]["events"] if e["kind"] == "correction_requested"
    )
    approved = await client.post(
        emp_url(eid, bid, f"attendance-corrections/{event['id']}/review"),
        headers=emp,
        json={"decision": "approved", "reason": "Confirmed with the manager"},
    )
    assert approved.json()["attendance"]["status"] == "checked_in"
    assert "no_show_reversed" in [e["kind"] for e in approved.json()["attendance"]["events"]]
    async with db_as("system") as session:
        assert "attendance.no_show_marked" in list(await session.scalars(select(Notification.kind)))


async def test_no_show_refused_when_worker_checked_in_and_reversible(client):
    emp, eid, cand, sid, bid, _ = await live(client, "att-noshow2", started_minutes_ago=45)
    assert (await client.post(cand_url(bid, "check-in"), headers=cand)).status_code == 200
    refused = await client.post(
        emp_url(eid, bid, "no-show"), headers=emp, json={"reason": "Absent"}
    )
    assert refused.status_code == 409 and refused.json()["error"]["code"] == "attendance_recorded"
    not_marked = await client.post(
        emp_url(eid, bid, "no-show/reverse"), headers=emp, json={"reason": "Mistake"}
    )
    assert not_marked.status_code == 409 and not_marked.json()["error"]["code"] == "not_no_show"


async def test_attendance_tenant_and_candidate_boundaries(client):
    emp, eid, cand, _, bid, _ = await live(client, "att-iso")
    other, _ = await register_employer(client, "att-other@nua-crew.example.com")
    worker = await register_candidate(client, "att-other-worker@nua-crew.example.com")
    assert (await client.post(cand_url(bid, "check-in"), headers=worker)).status_code == 404
    assert (await client.post(cand_url(bid, "check-out"), headers=worker)).status_code == 404
    assert (
        await client.post(
            cand_url(bid, "attendance-corrections"),
            headers=worker,
            json={
                "claim_kind": "check_in",
                "claimed_at": datetime.now(UTC).isoformat(),
                "reason": "x y",
            },
        )
    ).status_code == 404
    for tail in ("no-show", "no-show/reverse"):
        r = await client.post(emp_url(eid, bid, tail), headers=other, json={"reason": "Nope"})
        assert r.status_code == 404
    assert (
        await client.get(emp_url(eid, bid, "timesheet-history"), headers=other)
    ).status_code == 404
    assert (await client.get(cand_url(bid, "timesheet-history"), headers=worker)).status_code == 404
    cid = (await client.get("/v1/candidate/profile", headers=cand)).json()["id"]
    other_id = (await client.get("/v1/candidate/profile", headers=worker)).json()["id"]
    assert (await client.post(cand_url(bid, "check-in"), headers=cand)).status_code == 200
    for table in ("shift_attendance_events", "shift_timesheet_versions"):
        async with db_as("candidate", candidate_id=uuid.UUID(other_id)) as session:
            assert await session.scalar(text(f"SELECT count(*) FROM {table}")) == 0  # noqa: S608
    async with db_as("candidate", candidate_id=uuid.UUID(cid)) as session:
        assert await session.scalar(text("SELECT count(*) FROM shift_attendance_events")) == 1
    async with db_as("anonymous") as session:
        assert await session.scalar(text("SELECT count(*) FROM shift_attendance_events")) == 0


async def test_history_tables_are_append_only_and_runtime_cannot_write_them(client):
    _, _, cand, _, bid, _ = await live(client, "att-append")
    assert (await client.post(cand_url(bid, "check-in"), headers=cand)).status_code == 200
    for sql in (
        "UPDATE shift_attendance_events SET note = 'x'",
        "DELETE FROM shift_attendance_events",
    ):
        async with db_as("system") as session:
            with pytest.raises(DBAPIError):
                await session.execute(text(sql))
    cid = (await client.get("/v1/candidate/profile", headers=cand)).json()["id"]
    async with db_as("candidate", candidate_id=uuid.UUID(cid)) as session:
        with pytest.raises(DBAPIError):
            await session.execute(
                text(
                    "INSERT INTO shift_attendance_events (booking_id, kind, actor_role, time_zone) "
                    "VALUES (:bid, 'check_in', 'candidate', 'UTC')"
                ),
                {"bid": uuid.UUID(bid)},
            )


async def test_timesheet_history_keeps_every_version_and_decision(client):
    emp, eid, cand, sid, bid, _ = await live(client, "att-history")
    now = datetime.now(UTC).replace(second=0, microsecond=0)
    start, end = now - timedelta(hours=5), now - timedelta(hours=1)
    await move_shift(sid, start, end)
    payload = {
        "local_date": start.date().isoformat(),
        "local_start": start.time().isoformat(),
        "local_end": end.time().isoformat(),
        "time_zone": "UTC",
        "break_minutes": 30,
    }
    url = cand_url(bid, "timesheet")
    assert (await client.put(url, headers=cand, json=payload)).status_code == 200
    review = emp_url(eid, bid, "timesheet-review")
    assert (
        await client.post(
            review,
            headers=emp,
            json={"decision": "disputed", "reason": "Break looks long", "expected_version": 1},
        )
    ).status_code == 200
    assert (
        await client.put(url, headers=cand, json={**payload, "break_minutes": 15})
    ).status_code == 200
    assert (
        await client.post(
            review,
            headers=emp,
            json={"decision": "approved", "reason": "Fine now", "expected_version": 2},
        )
    ).status_code == 200
    history = (await client.get(cand_url(bid, "timesheet-history"), headers=cand)).json()
    assert [(h["version"], h["status"], h["break_minutes"]) for h in history] == [
        (1, "submitted", 30),
        (1, "disputed", 30),
        (2, "submitted", 15),
        (2, "approved", 15),
    ]
    assert history[1]["review_note"] == "Break looks long"
    assert history[0]["worked_minutes"] == 210 and history[2]["worked_minutes"] == 225
    business = (await client.get(emp_url(eid, bid, "timesheet-history"), headers=emp)).json()
    assert business == history
    async with db_as("system") as session:
        with pytest.raises(DBAPIError):
            await session.execute(text("UPDATE shift_timesheet_versions SET break_minutes = 0"))


async def test_venue_local_correction_resolves_using_the_stored_shift_zone(client):
    from zoneinfo import ZoneInfo

    emp, eid, cand, _, bid, start = await live(client, "att-local")
    local = (
        (start - timedelta(minutes=2))
        .astimezone(ZoneInfo("Australia/Melbourne"))
        .replace(second=0, microsecond=0)
    )
    result = await client.post(
        cand_url(bid, "attendance-corrections"),
        headers=cand,
        json={
            "claim_kind": "check_in",
            "local_date": local.date().isoformat(),
            "local_time": local.time().isoformat(),
            "reason": "Arrived before opening the app",
        },
    )
    assert result.status_code == 200, result.text
    event = next(
        e for e in result.json()["attendance"]["events"] if e["kind"] == "correction_requested"
    )
    assert datetime.fromisoformat(event["claimed_at"]) == local.astimezone(UTC)
    assert result.json()["attendance"]["check_in_at"] is None
    # Another business cannot review a guessed correction ID.
    other, other_eid = await register_employer(client, "local-other@example.invalid")
    denied = await client.post(
        emp_url(other_eid, bid, f"attendance-corrections/{event['id']}/review"),
        headers=other,
        json={"decision": "approved", "reason": "Guessed record"},
    )
    assert denied.status_code == 404
