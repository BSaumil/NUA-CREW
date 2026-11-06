from sqlalchemy import select

from app.config import get_settings
from app.models import AuditEvent
from tests.conftest import (
    JOB,
    admin_headers,
    db_as,
    register_employer,
    verified_employer,
)
from tests.test_hospitality_api import WAITER, assess, publish

PAY = {"pay_min": "34.00", "pay_max": "40.00", "pay_period": "hour"}


async def _legacy(client, headers, eid, **over):
    """A job saved the old way: no role, no pay check."""
    locs = (await client.get(f"/v1/employers/{eid}/locations", headers=headers)).json()
    body = {**JOB, **PAY, "location_id": locs[0]["id"], "employment_type": "casual", **over}
    r = await client.post(f"/v1/employers/{eid}/jobs", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def _gaps(eid):
    return f"/v1/employers/{eid}/jobs-missing-role"


def _attach(eid, job_id):
    return f"/v1/employers/{eid}/jobs/{job_id}/role"


async def test_gap_list_shows_only_own_open_jobs_without_a_role(client, monkeypatch):
    emp, eid = await verified_employer(client, "gap-a@nua-crew.example.com")
    a = await _legacy(client, emp, eid, title="Legacy draft")
    b = await _legacy(client, emp, eid, title="Legacy live")
    assert (await publish(client, emp, eid, b["id"])).status_code == 200
    closed = await _legacy(client, emp, eid, title="Legacy closed")
    await publish(client, emp, eid, closed["id"])
    await client.post(f"/v1/employers/{eid}/jobs/{closed['id']}/close", headers=emp)

    other, other_eid = await verified_employer(client, "gap-b@nua-crew.example.com", "Other Cafe")
    await _legacy(client, other, other_eid, title="Not yours")

    got = (await client.get(_gaps(eid), headers=emp)).json()
    assert got["required"] is False
    assert {j["title"] for j in got["jobs"]} == {"Legacy draft", "Legacy live"}
    assert {j["id"] for j in got["jobs"]} == {a["id"], b["id"]}

    monkeypatch.setattr(get_settings(), "require_role_on_publish", True)
    assert (await client.get(_gaps(eid), headers=emp)).json()["required"] is True

    # Another business gets 404, and nobody signed out gets in.
    assert (await client.get(_gaps(eid), headers=other)).status_code == 404
    assert (await client.get(_gaps(eid))).status_code == 401


async def test_attaching_a_pay_check_gives_the_job_a_role_and_lets_it_publish(client, monkeypatch):
    emp, eid = await verified_employer(client, "gap-c@nua-crew.example.com")
    job = await _legacy(client, emp, eid)
    monkeypatch.setattr(get_settings(), "require_role_on_publish", True)
    blocked = await publish(client, emp, eid, job["id"])
    assert blocked.status_code == 409 and blocked.json()["error"]["code"] == "role_required"

    a = await assess(client, emp, eid, pay_amount="33.85")
    r = await client.post(_attach(eid, job["id"]), headers=emp, json={"pay_assessment_id": a["id"]})
    assert r.status_code == 200, r.text
    out = r.json()
    assert out["role"]["code"] == WAITER and out["pay_assessment_id"] == a["id"]
    # The advertisement now matches the check; the hourly maximum above it is kept.
    assert out["pay_min"] == "33.85" and out["pay_max"] == "40.00" and out["pay_period"] == "hour"
    assert out["title"] == job["title"] and out["description"] == job["description"]
    assert (await client.get(_gaps(eid), headers=emp)).json()["jobs"] == []

    assert (await publish(client, emp, eid, job["id"])).status_code == 200
    async with db_as() as s:
        ev = (
            await s.scalars(
                select(AuditEvent).where(
                    AuditEvent.action == "job.role_attached", AuditEvent.entity_id == job["id"]
                )
            )
        ).one()
        assert ev.meta["role_code"] == WAITER and ev.meta["before"]["pay_min"] == "34.00"


async def test_a_lower_maximum_is_raised_to_the_checked_rate(client):
    emp, eid = await verified_employer(client, "gap-d@nua-crew.example.com")
    job = await _legacy(client, emp, eid, pay_min="20.00", pay_max="30.00")
    a = await assess(client, emp, eid, pay_amount="33.85")
    out = (
        await client.post(_attach(eid, job["id"]), headers=emp, json={"pay_assessment_id": a["id"]})
    ).json()
    assert out["pay_min"] == "33.85" and out["pay_max"] == "33.85"


async def test_unsuitable_pay_checks_are_refused_without_changing_the_job(client):
    emp, eid = await verified_employer(client, "gap-e@nua-crew.example.com")
    job = await _legacy(client, emp, eid)
    ghost = "00000000-0000-0000-0000-000000000000"
    missing = await client.post(
        _attach(eid, job["id"]), headers=emp, json={"pay_assessment_id": ghost}
    )
    assert missing.status_code == 404

    # A pay check made for permanent work does not describe a casual job.
    wrong_type = await assess(client, emp, eid, employment="full_time", pay_amount="30.00")
    r = await client.post(
        _attach(eid, job["id"]), headers=emp, json={"pay_assessment_id": wrong_type["id"]}
    )
    assert r.status_code == 422 and r.json()["error"]["code"] == "employment_mismatch"
    after = (await client.get(f"/v1/employers/{eid}/jobs/{job['id']}", headers=emp)).json()
    assert after["role"] is None and after["pay_min"] == "34.00"


async def test_other_businesses_checks_viewers_and_closed_jobs_cannot_be_used(client):
    owner, eid = await verified_employer(client, "gap-f@nua-crew.example.com")
    rival, rival_eid = await verified_employer(client, "gap-g@nua-crew.example.com", "Rival Cafe")
    job = await _legacy(client, owner, eid)
    theirs = await assess(client, rival, rival_eid)
    # A pay check from another business is "not found", never accepted.
    r = await client.post(
        _attach(eid, job["id"]), headers=owner, json={"pay_assessment_id": theirs["id"]}
    )
    assert r.status_code == 404
    # A non-member cannot touch the job at all.
    mine = await assess(client, owner, eid)
    assert (
        await client.post(
            _attach(eid, job["id"]), headers=rival, json={"pay_assessment_id": mine["id"]}
        )
    ).status_code == 404

    view, _ = await register_employer(client, "gap-view@nua-crew.example.com", "Viewer Org")
    added = await client.post(
        f"/v1/employers/{eid}/members",
        json={"email": "gap-view@nua-crew.example.com", "role": "viewer"},
        headers=owner,
    )
    assert added.status_code == 201
    assert (
        await client.post(
            _attach(eid, job["id"]), headers=view, json={"pay_assessment_id": mine["id"]}
        )
    ).status_code == 403

    await publish(client, owner, eid, job["id"])
    await client.post(f"/v1/employers/{eid}/jobs/{job['id']}/close", headers=owner)
    closed = await client.post(
        _attach(eid, job["id"]), headers=owner, json={"pay_assessment_id": mine["id"]}
    )
    assert closed.status_code == 409 and closed.json()["error"]["code"] == "job_closed"


async def test_operators_can_see_how_many_ads_a_switch_would_affect(client, monkeypatch):
    emp, eid = await verified_employer(client, "gap-h@nua-crew.example.com")
    await _legacy(client, emp, eid)
    live = await _legacy(client, emp, eid)
    await publish(client, emp, eid, live["id"])
    admin = await admin_headers(client)
    got = (await client.get("/v1/admin/awards/role-coverage", headers=admin)).json()
    assert got["require_role_on_publish"] is False
    assert got["jobs_missing_role"] == {"draft": 1, "published": 1}
    assert got["employers_affected"] == 1
    monkeypatch.setattr(get_settings(), "require_role_on_publish", True)
    assert (await client.get("/v1/admin/awards/role-coverage", headers=admin)).json()[
        "require_role_on_publish"
    ] is True
    assert (await client.get("/v1/admin/awards/role-coverage", headers=emp)).status_code in (
        401,
        403,
    )
    assert (await client.get("/v1/admin/awards/role-coverage")).status_code in (401, 403)
