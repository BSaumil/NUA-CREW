import asyncio
import uuid

import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError

from app.rls import set_context
from tests.conftest import (
    JOB,
    PASSWORD,
    admin_headers,
    auth,
    db_as,
    published_job,
    register_candidate,
    register_employer,
    verified_employer,
)

pytestmark = pytest.mark.asyncio


async def test_vertical_slice(client):
    """Employer posts -> candidate finds, matches, applies -> employer advances -> candidate sees."""
    emp, eid = await verified_employer(client, "owner@a.example.com")
    job = await published_job(client, emp, eid)
    assert job["pay_basis"] == "disclosed" and job["suburb"] == "Fitzroy"

    cand = await register_candidate(client, "cand@a.example.com", "Alex Candidate")
    await client.put(
        "/v1/candidate/profile",
        json={
            "full_name": "Alex Candidate",
            "suburb": "Fitzroy",
            "state": "VIC",
            "postcode": "3065",
            "preferred_employment_types": ["casual"],
            "min_hourly_pay": "27.00",
            "skills": ["Barista"],
        },
        headers=cand,
    )
    resume = (
        await client.post(
            "/v1/candidate/resumes",
            json={"title": "Main", "content_text": "Alex. Five years making coffee."},
            headers=cand,
        )
    ).json()

    found = (await client.get("/v1/jobs", params={"q": "coffee", "suburb": "fitzroy"})).json()
    assert [j["id"] for j in found["items"]] == [job["id"]]

    match = (await client.get(f"/v1/jobs/{job['id']}/match", headers=cand)).json()
    assert match["estimate"] is not None and "not a prediction" in match["label"]
    assert match["missing_skills"] == ["Customer Service"]
    not_eval = {c["key"] for c in match["components"] if not c["evaluated"]}
    assert {"semantic", "experience", "trajectory"} <= not_eval

    r = await client.post(
        f"/v1/jobs/{job['id']}/applications",
        json={"resume_id": resume["id"], "cover_note": "Keen!"},
        headers=cand,
    )
    assert r.status_code == 201
    app_id = r.json()["id"]
    assert [e["event_type"] for e in r.json()["events"]] == ["submitted"]

    pipeline = (
        await client.get(f"/v1/employers/{eid}/jobs/{job['id']}/applications", headers=emp)
    ).json()
    assert [a["application_id"] for a in pipeline] == [app_id]
    detail = (await client.get(f"/v1/employers/{eid}/applications/{app_id}", headers=emp)).json()
    assert detail["resume_text"].startswith("Alex.")

    r = await client.post(
        f"/v1/employers/{eid}/applications/{app_id}/status",
        json={"to_status": "under_review"},
        headers=emp,
    )
    assert r.status_code == 200
    mine = (await client.get(f"/v1/candidate/applications/{app_id}", headers=cand)).json()
    assert mine["status"] == "under_review"
    assert [e["event_type"] for e in mine["events"]] == ["submitted", "status_changed"]
    kinds = [n["kind"] for n in (await client.get("/v1/notifications", headers=cand)).json()]
    assert kinds == ["application.status_changed"]
    owner_kinds = [n["kind"] for n in (await client.get("/v1/notifications", headers=emp)).json()]
    assert owner_kinds == ["application.received"]


async def test_unverified_employer_cannot_publish(client):
    emp, eid = await register_employer(client, "owner@u.example.com")
    locs = (await client.get(f"/v1/employers/{eid}/locations", headers=emp)).json()
    job = (
        await client.post(
            f"/v1/employers/{eid}/jobs", json={**JOB, "location_id": locs[0]["id"]}, headers=emp
        )
    ).json()
    r = await client.post(f"/v1/employers/{eid}/jobs/{job['id']}/publish", headers=emp)
    assert r.status_code == 403
    assert (await client.get(f"/v1/jobs/{job['id']}")).status_code == 404  # drafts are not public


async def test_employer_tenant_isolation(client):
    a, ea = await verified_employer(client, "owner@a.example.com", "A")
    b, eb = await verified_employer(client, "owner@b.example.com", "B")
    job_a = await published_job(client, a, ea)
    cand = await register_candidate(client, "c@x.example.com")
    app_id = (
        await client.post(f"/v1/jobs/{job_a['id']}/applications", json={}, headers=cand)
    ).json()["id"]

    # B guessing A's identifiers, through B's own tenant path and through A's path.
    probes = [
        ("get", f"/v1/employers/{ea}", None),
        ("get", f"/v1/employers/{ea}/jobs", None),
        ("get", f"/v1/employers/{ea}/jobs/{job_a['id']}", None),
        ("get", f"/v1/employers/{ea}/jobs/{job_a['id']}/applications", None),
        ("get", f"/v1/employers/{ea}/applications/{app_id}", None),
        ("get", f"/v1/employers/{eb}/jobs/{job_a['id']}", None),
        ("get", f"/v1/employers/{eb}/jobs/{job_a['id']}/applications", None),
        ("get", f"/v1/employers/{eb}/applications/{app_id}", None),
        ("post", f"/v1/employers/{eb}/applications/{app_id}/status", {"to_status": "under_review"}),
        ("post", f"/v1/employers/{ea}/applications/{app_id}/status", {"to_status": "under_review"}),
        ("post", f"/v1/employers/{eb}/jobs/{job_a['id']}/close", None),
        ("put", f"/v1/employers/{eb}/jobs/{job_a['id']}", {**JOB}),
    ]
    for method, url, body in probes:
        r = await getattr(client, method)(url, headers=b, **({"json": body} if body else {}))
        assert r.status_code == 404, (method, url, r.status_code, r.text)
        assert "Barista" not in r.text and "Candidate" not in r.text

    # A's data is untouched.
    assert (await client.get(f"/v1/jobs/{job_a['id']}")).json()["status"] == "published"
    detail = (await client.get(f"/v1/employers/{ea}/applications/{app_id}", headers=a)).json()
    assert detail["status"] == "submitted"


async def test_location_from_other_tenant_rejected(client):
    a, ea = await verified_employer(client, "owner@a.example.com", "A")
    b, eb = await verified_employer(client, "owner@b.example.com", "B")
    loc_a = (await client.get(f"/v1/employers/{ea}/locations", headers=a)).json()[0]["id"]
    r = await client.post(f"/v1/employers/{eb}/jobs", json={**JOB, "location_id": loc_a}, headers=b)
    assert r.status_code == 422


async def test_candidate_isolation(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    job = await published_job(client, emp, eid)
    ca = await register_candidate(client, "a@x.example.com", "Alice")
    cb = await register_candidate(client, "b@x.example.com", "Bob")
    resume = (
        await client.post(
            "/v1/candidate/resumes",
            json={"title": "Secret", "content_text": "alice secret"},
            headers=ca,
        )
    ).json()
    app_id = (
        await client.post(
            f"/v1/jobs/{job['id']}/applications", json={"resume_id": resume["id"]}, headers=ca
        )
    ).json()["id"]

    assert (
        await client.get(f"/v1/candidate/resumes/{resume['id']}", headers=cb)
    ).status_code == 404
    assert (await client.get(f"/v1/candidate/applications/{app_id}", headers=cb)).status_code == 404
    assert (
        await client.post(f"/v1/candidate/applications/{app_id}/withdraw", headers=cb)
    ).status_code == 404
    r = await client.post(
        f"/v1/jobs/{job['id']}/applications", json={"resume_id": resume["id"]}, headers=cb
    )
    assert r.status_code == 422  # cannot attach someone else's resume
    assert (await client.get("/v1/candidate/applications", headers=cb)).json() == []
    # Employers cannot read candidate-only endpoints.
    assert (await client.get("/v1/candidate/profile", headers=emp)).status_code == 403


async def test_no_candidate_leak_without_application(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    job = await published_job(client, emp, eid)
    await register_candidate(client, "lurker@x.example.com", "Lurker Person")
    pipeline = (
        await client.get(f"/v1/employers/{eid}/jobs/{job['id']}/applications", headers=emp)
    ).json()
    assert pipeline == []
    # Talent discovery is opt-in and off by default.
    cand = await register_candidate(client, "c2@x.example.com")
    assert (await client.get("/v1/candidate/profile", headers=cand)).json()["discoverable"] is False


async def test_single_active_application_and_reapply_after_withdraw(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    job = await published_job(client, emp, eid)
    cand = await register_candidate(client, "c@x.example.com")
    url = f"/v1/jobs/{job['id']}/applications"
    first = await client.post(url, json={}, headers=cand)
    assert first.status_code == 201
    dup = await client.post(url, json={}, headers=cand)
    assert dup.status_code == 409 and dup.json()["error"]["code"] == "already_applied"
    app_id = first.json()["id"]
    assert (
        await client.post(f"/v1/candidate/applications/{app_id}/withdraw", headers=cand)
    ).status_code == 200
    again = await client.post(url, json={}, headers=cand)
    assert again.status_code == 201 and again.json()["id"] != app_id


async def test_concurrent_duplicate_applications_create_one(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    job = await published_job(client, emp, eid)
    cand = await register_candidate(client, "c@x.example.com")
    url = f"/v1/jobs/{job['id']}/applications"
    rs = await asyncio.gather(*[client.post(url, json={}, headers=cand) for _ in range(5)])
    assert sorted(r.status_code for r in rs) == [201, 409, 409, 409, 409]
    assert len((await client.get("/v1/candidate/applications", headers=cand)).json()) == 1


async def test_idempotency_key_replays_same_application(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    job = await published_job(client, emp, eid)
    cand = await register_candidate(client, "c@x.example.com")
    h = {**cand, "Idempotency-Key": "abc-123"}
    url = f"/v1/jobs/{job['id']}/applications"
    r1 = await client.post(url, json={}, headers=h)
    r2 = await client.post(url, json={}, headers=h)
    assert r1.status_code == 201 and r2.status_code == 201 and r1.json()["id"] == r2.json()["id"]


async def test_roles_and_decision_rules(client):
    owner, eid = await verified_employer(client, "owner@a.example.com")
    # add recruiter + viewer
    rec, _ = await register_employer(client, "rec@a.example.com", "Other1")
    view, _ = await register_employer(client, "view@a.example.com", "Other2")
    for email, role in (("rec@a.example.com", "recruiter"), ("view@a.example.com", "viewer")):
        r = await client.post(
            f"/v1/employers/{eid}/members", json={"email": email, "role": role}, headers=owner
        )
        assert r.status_code == 201, r.text
    assert (
        await client.post(
            f"/v1/employers/{eid}/members",
            json={"email": "rec@a.example.com", "role": "viewer"},
            headers=rec,
        )
    ).status_code == 403

    job = await published_job(client, rec, eid)  # recruiter can create + publish
    cand = await register_candidate(client, "c@x.example.com")
    app_id = (
        await client.post(f"/v1/jobs/{job['id']}/applications", json={}, headers=cand)
    ).json()["id"]
    st = f"/v1/employers/{eid}/applications/{app_id}/status"

    assert (await client.get(f"/v1/employers/{eid}/jobs", headers=view)).status_code == 200
    assert (
        await client.post(st, json={"to_status": "under_review"}, headers=view)
    ).status_code == 403
    assert (
        await client.post(f"/v1/employers/{eid}/jobs", json=JOB, headers=view)
    ).status_code == 403
    # skipping stages is rejected; rejection needs a human reason
    assert (await client.post(st, json={"to_status": "offer"}, headers=rec)).status_code == 409
    assert (await client.post(st, json={"to_status": "rejected"}, headers=rec)).status_code == 422
    ok = await client.post(st, json={"to_status": "rejected", "note": "Role filled"}, headers=rec)
    assert ok.status_code == 200
    assert (
        await client.post(st, json={"to_status": "under_review"}, headers=rec)
    ).status_code == 409

    mine = (await client.get(f"/v1/candidate/applications/{app_id}", headers=cand)).json()
    assert mine["status"] == "rejected"
    assert all(e["note"] is None for e in mine["events"] if e["actor_role"] == "employer")


async def test_private_notes_hidden_from_candidate(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    job = await published_job(client, emp, eid)
    cand = await register_candidate(client, "c@x.example.com")
    app_id = (
        await client.post(f"/v1/jobs/{job['id']}/applications", json={}, headers=cand)
    ).json()["id"]
    r = await client.post(
        f"/v1/employers/{eid}/applications/{app_id}/notes",
        json={"note": "internal: seems keen"},
        headers=emp,
    )
    assert r.status_code == 201
    assert any(e["note"] == "internal: seems keen" for e in r.json()["events"])
    mine = (await client.get(f"/v1/candidate/applications/{app_id}", headers=cand)).json()
    assert "internal" not in str(mine)


async def test_history_is_append_only_at_db_level(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    job = await published_job(client, emp, eid)
    cand = await register_candidate(client, "c@x.example.com")
    await client.post(f"/v1/jobs/{job['id']}/applications", json={}, headers=cand)
    async with db_as() as s:
        for stmt in (
            "UPDATE application_events SET note='tampered'",
            "DELETE FROM application_events",
            "UPDATE audit_events SET action='x'",
            "DELETE FROM audit_events",
        ):
            # Two independent layers: RLS has no UPDATE policy on events (0 rows touched) and a
            # trigger rejects any mutation that does reach a row. Either way nothing changes.
            try:
                result = await s.execute(text(stmt))
                assert result.rowcount == 0, stmt
            except DBAPIError:
                await s.rollback()
                await set_context(s, role="system")  # settings are transaction-local
        events = (await s.execute(text("select count(*) from application_events"))).scalar()
        audits = (
            await s.execute(text("select count(*) from audit_events where action='x'"))
        ).scalar()
        assert events == 1 and audits == 0


async def test_search_only_returns_open_jobs_and_filters(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    j1 = await published_job(client, emp, eid, title="Barista")
    j2 = await published_job(
        client, emp, eid, title="Chef", category="Kitchen", employment_type="full_time"
    )
    await client.post(f"/v1/employers/{eid}/jobs/{j2['id']}/close", headers=emp)
    res = (await client.get("/v1/jobs")).json()
    assert [j["id"] for j in res["items"]] == [j1["id"]] and res["total"] == 1
    assert (await client.get(f"/v1/jobs/{j2['id']}")).status_code == 404
    assert (await client.get("/v1/jobs", params={"employment_type": "full_time"})).json()[
        "total"
    ] == 0
    assert (await client.get("/v1/jobs", params={"skill": "customer service"})).json()["total"] == 1
    assert (await client.get("/v1/jobs", params={"q": "zzzz"})).json()["total"] == 0
    assert (await client.get("/v1/jobs", params={"page_size": 500})).status_code == 422


async def test_job_pay_validation(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    base = f"/v1/employers/{eid}/jobs"
    assert (
        await client.post(base, json={**JOB, "pay_min": "40", "pay_max": "30"}, headers=emp)
    ).status_code == 422
    assert (
        await client.post(base, json={**JOB, "pay_period": None}, headers=emp)
    ).status_code == 422
    nopay = {k: v for k, v in JOB.items() if not k.startswith("pay_")}
    r = await client.post(base, json=nopay, headers=emp)
    assert r.status_code == 201 and r.json()["pay_basis"] == "not_disclosed"


async def test_auth_basics(client):
    await register_candidate(client, "dup@x.example.com")
    r = await client.post(
        "/v1/auth/register/candidate",
        json={
            "email": "DUP@x.example.com",
            "password": PASSWORD,
            "full_name": "x",
            "accept_terms": True,
        },
    )
    assert r.status_code == 409
    bad = await client.post(
        "/v1/auth/login", json={"email": "dup@x.example.com", "password": "wrong-password-1"}
    )
    unknown = await client.post(
        "/v1/auth/login", json={"email": "no@x.example.com", "password": "wrong-password-1"}
    )
    assert bad.status_code == unknown.status_code == 401 and bad.json() == unknown.json()
    assert (await client.get("/v1/auth/me")).status_code == 401
    assert (await client.get("/v1/auth/me", headers=auth("not.a.jwt"))).status_code == 401
    weak = await client.post(
        "/v1/auth/register/candidate",
        json={
            "email": "w@x.example.com",
            "password": "short",
            "full_name": "x",
            "accept_terms": True,
        },
    )
    assert weak.status_code == 422
    badabn = await client.post(
        "/v1/auth/register/employer",
        json={
            "email": "e@x.example.com",
            "password": PASSWORD,
            "full_name": "x",
            "organisation_name": "x",
            "abn": "12345678901",
            "accept_terms": True,
        },
    )
    assert badabn.status_code == 422


async def test_login_rate_limit(client, monkeypatch):
    from app.config import get_settings

    monkeypatch.setattr(get_settings(), "auth_rate_limit_per_minute", 3)
    codes = [
        (
            await client.post(
                "/v1/auth/login", json={"email": "r@x.example.com", "password": "nope-nope-nope"}
            )
        ).status_code
        for _ in range(5)
    ]
    assert codes[:3] == [401, 401, 401] and codes[3:] == [429, 429]


async def test_admin_endpoints_require_admin(client):
    emp, eid = await register_employer(client, "owner@a.example.com")
    cand = await register_candidate(client, "c@x.example.com")
    for h in (emp, cand):
        r = await client.post(
            f"/v1/admin/employers/{eid}/verification",
            json={"status": "verified", "evidence": "self"},
            headers=h,
        )
        assert r.status_code == 403
    admin = await admin_headers(client)
    r = await client.post(
        f"/v1/admin/employers/{eid}/verification",
        json={"status": "verified", "evidence": "ok"},
        headers=admin,
    )
    assert r.status_code == 200 and r.json()["verification_status"] == "verified"
    async with db_as() as s:
        n = (
            await s.execute(
                text("select count(*) from audit_events where action='employer.verification'")
            )
        ).scalar()
    assert n == 1


async def test_notification_isolation(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    job = await published_job(client, emp, eid)
    cand = await register_candidate(client, "c@x.example.com")
    await client.post(f"/v1/jobs/{job['id']}/applications", json={}, headers=cand)
    nid = (await client.get("/v1/notifications", headers=emp)).json()[0]["id"]
    assert (await client.post(f"/v1/notifications/{nid}/read", headers=cand)).status_code == 404
    assert (await client.post(f"/v1/notifications/{nid}/read", headers=emp)).json()["read_at"]
    assert (
        await client.post(f"/v1/notifications/{uuid.uuid4()}/read", headers=emp)
    ).status_code == 404


async def test_edit_unpublish_and_republish_cycle(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    view, _ = await register_employer(client, "view@a.example.com", "Other")
    job = await published_job(client, emp, eid)
    base = f"/v1/employers/{eid}/jobs/{job['id']}"

    # edit a live job in place: title and pay change, history is kept
    edited = {
        **JOB,
        "title": "Head Barista",
        "pay_min": "31",
        "pay_max": "36",
        "location_id": job["location_id"],
    }
    r = await client.put(base, json=edited, headers=emp)
    assert r.status_code == 200 and r.json()["title"] == "Head Barista"
    assert (await client.get(f"/v1/jobs/{job['id']}")).json()["pay_min"] == "31.00"

    # unpublish hides it from the public but keeps it editable; viewers/other tenants cannot
    assert (await client.post(f"{base}/unpublish", headers=view)).status_code == 404
    r = await client.post(f"{base}/unpublish", headers=emp)
    assert r.status_code == 200 and r.json()["status"] == "unpublished"
    assert (await client.get(f"/v1/jobs/{job['id']}")).status_code == 404
    assert (await client.get("/v1/jobs")).json()["total"] == 0
    assert (await client.post(f"{base}/unpublish", headers=emp)).status_code == 409

    assert (
        await client.put(base, json={**edited, "title": "Barista (weekends)"}, headers=emp)
    ).status_code == 200
    assert (await client.post(f"{base}/publish", headers=emp)).json()["status"] == "published"
    assert (await client.get("/v1/jobs", params={"q": "weekends"})).json()["total"] == 1

    await client.post(f"{base}/close", headers=emp)
    assert (await client.post(f"{base}/unpublish", headers=emp)).status_code == 409
    assert (await client.put(base, json=edited, headers=emp)).status_code == 409
    async with db_as() as s:
        n = (await s.execute(text("select count(*) from job_versions"))).scalar()
        a = (
            await s.execute(
                text("select count(*) from audit_events where action='job.unpublished'")
            )
        ).scalar()
    assert n >= 5 and a == 1
