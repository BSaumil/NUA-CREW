from datetime import UTC, datetime, timedelta

from sqlalchemy import select, text

from app.models import AuditEvent, Job
from tests.conftest import (
    JOB,
    db_as,
    register_candidate,
    register_employer,
    verified_employer,
)

WAITER = "HC-0060"


async def _make(client, headers, eid, **over):
    locs = (await client.get(f"/v1/employers/{eid}/locations", headers=headers)).json()
    r = await client.post(
        f"/v1/employers/{eid}/jobs",
        json={**JOB, "location_id": locs[0]["id"], **over},
        headers=headers,
    )
    assert r.status_code == 201, r.text
    return r.json()


def _dup(eid, job_id):
    return f"/v1/employers/{eid}/jobs/{job_id}/duplicate"


async def test_duplicate_is_a_fresh_draft_with_the_same_description_of_work(client):
    emp, eid = await verified_employer(client, "dup-a@nua-crew.example.com")
    src = await _make(client, emp, eid)
    assert (
        await client.post(f"/v1/employers/{eid}/jobs/{src['id']}/publish", headers=emp)
    ).status_code == 200

    r = await client.post(_dup(eid, src["id"]), headers=emp)
    assert r.status_code == 201, r.text
    copy = r.json()
    assert copy["id"] != src["id"]
    assert copy["status"] == "draft" and copy["published_at"] is None
    for key in ("title", "description", "employment_type", "pay_min", "pay_max", "location_id"):
        assert copy[key] == src[key]
    assert sorted(copy["skills"]) == sorted(src["skills"])
    # The original is untouched and still live.
    again = (await client.get(f"/v1/employers/{eid}/jobs/{src['id']}", headers=emp)).json()
    assert again["status"] == "published"
    # A draft is not public.
    pub = await client.get(f"/v1/jobs/{copy['id']}")
    assert pub.status_code == 404


async def test_duplicate_works_for_a_closed_job_and_does_not_carry_applications(client):
    emp, eid = await verified_employer(client, "dup-b@nua-crew.example.com")
    src = await _make(client, emp, eid)
    await client.post(f"/v1/employers/{eid}/jobs/{src['id']}/publish", headers=emp)
    cand = await register_candidate(client, "dup-cand@nua-crew.example.com")
    assert (
        await client.post(f"/v1/jobs/{src['id']}/applications", json={}, headers=cand)
    ).status_code == 201
    await client.post(f"/v1/employers/{eid}/jobs/{src['id']}/close", headers=emp)

    copy = (await client.post(_dup(eid, src["id"]), headers=emp)).json()
    assert copy["status"] == "draft"
    apps = (
        await client.get(f"/v1/employers/{eid}/jobs/{copy['id']}/applications", headers=emp)
    ).json()
    assert apps == []
    # The copy can be published as a new advertisement; the closed original stays closed.
    assert (
        await client.post(f"/v1/employers/{eid}/jobs/{copy['id']}/publish", headers=emp)
    ).status_code == 200
    old = (await client.get(f"/v1/employers/{eid}/jobs/{src['id']}", headers=emp)).json()
    assert old["status"] == "closed"


async def test_closing_date_and_past_start_date_are_not_copied(client):
    emp, eid = await verified_employer(client, "dup-c@nua-crew.example.com")
    soon = (datetime.now(UTC) + timedelta(days=5)).isoformat()
    src = await _make(client, emp, eid, expires_at=soon)
    async with db_as() as s:  # backdate the start so it is stale, as after a long-closed ad
        await s.execute(
            text("update jobs set start_date=:d, end_date=:e where id=:i"),
            {
                "d": (datetime.now(UTC) - timedelta(days=30)).date(),
                "e": (datetime.now(UTC) - timedelta(days=10)).date(),
                "i": src["id"],
            },
        )
        await s.commit()
    copy = (await client.post(_dup(eid, src["id"]), headers=emp)).json()
    assert copy["expires_at"] is None
    assert copy["start_date"] is None and copy["end_date"] is None


async def test_future_dates_are_kept(client):
    emp, eid = await verified_employer(client, "dup-d@nua-crew.example.com")
    start = (datetime.now(UTC) + timedelta(days=10)).date()
    end = start + timedelta(days=20)
    src = await _make(client, emp, eid, start_date=start.isoformat(), end_date=end.isoformat())
    copy = (await client.post(_dup(eid, src["id"]), headers=emp)).json()
    assert copy["start_date"] == start.isoformat() and copy["end_date"] == end.isoformat()


async def test_role_is_copied_but_the_pay_check_is_not(client):
    from tests.test_hospitality_api import assess, make_job, publish

    emp, eid = await verified_employer(client, "dup-e@nua-crew.example.com")
    a = await assess(client, emp, eid)
    made = await make_job(client, emp, eid, a["id"])
    assert made.status_code == 201, made.text
    src = made.json()
    assert src["pay_assessment_id"] == a["id"]
    assert (await publish(client, emp, eid, src["id"])).status_code == 200

    copy = (await client.post(_dup(eid, src["id"]), headers=emp)).json()
    assert copy["role"] and copy["role"]["code"] == WAITER
    assert copy["pay_assessment_id"] is None
    # A role-based copy cannot publish until it has its own current pay check.
    r = await publish(client, emp, eid, copy["id"])
    assert r.status_code == 409 and r.json()["error"]["code"] == "pay_assessment_required"
    # The source is unchanged.
    old = (await client.get(f"/v1/employers/{eid}/jobs/{src['id']}", headers=emp)).json()
    # Publishing stores a fresh assessment against today's rules, so only presence is stable.
    assert old["pay_assessment_id"] is not None and old["status"] == "published"


async def test_viewers_and_other_businesses_cannot_duplicate(client):
    owner, eid = await verified_employer(client, "dup-f@nua-crew.example.com")
    view, _ = await register_employer(client, "dup-view@nua-crew.example.com", "Other View")
    r = await client.post(
        f"/v1/employers/{eid}/members",
        json={"email": "dup-view@nua-crew.example.com", "role": "viewer"},
        headers=owner,
    )
    assert r.status_code == 201, r.text
    src = await _make(client, owner, eid)
    assert (await client.post(_dup(eid, src["id"]), headers=view)).status_code == 403

    rival, rival_eid = await verified_employer(client, "dup-rival@nua-crew.example.com", "Rival")
    # Non-member of the source business: 404 whichever id is used, and nothing is created.
    assert (await client.post(_dup(eid, src["id"]), headers=rival)).status_code == 404
    assert (await client.post(_dup(rival_eid, src["id"]), headers=rival)).status_code == 404
    assert (await client.get(f"/v1/employers/{rival_eid}/jobs", headers=rival)).json() == []


async def test_duplicate_is_audited_and_counts_against_the_creation_limit(client, monkeypatch):
    from app.config import get_settings

    emp, eid = await verified_employer(client, "dup-g@nua-crew.example.com")
    src = await _make(client, emp, eid)
    copy = (await client.post(_dup(eid, src["id"]), headers=emp)).json()
    async with db_as() as s:
        ev = (
            await s.scalars(
                select(AuditEvent).where(
                    AuditEvent.action == "job.duplicated", AuditEvent.entity_id == copy["id"]
                )
            )
        ).one()
        assert ev.meta["source_job_id"] == src["id"]
        n = await s.scalar(text("select count(*) from jobs where employer_id=:e"), {"e": eid})
    assert n == 2

    monkeypatch.setattr(get_settings(), "job_create_limit_per_hour", 2)
    assert (await client.post(_dup(eid, src["id"]), headers=emp)).status_code == 429
    _ = Job  # keep the import used for type checkers
