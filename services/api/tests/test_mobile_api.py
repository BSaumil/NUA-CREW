"""Backend features that the mobile apps depend on."""

import uuid
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import text

from app.services import tokens
from app.services.alerts import run_alerts
from app.services.push import PushMessage, PushResult, deliver_pending
from tests.conftest import (
    JOB,
    PASSWORD,
    auth,
    db_as,
    published_job,
    register_candidate,
    verified_employer,
)

pytestmark = pytest.mark.asyncio


async def test_native_employer_registration_issues_a_rotating_session(client):
    response = await client.post(
        "/v1/auth/register/employer",
        json={
            "email": "native-owner@nua-crew.example.com",
            "password": PASSWORD,
            "full_name": "Native Owner",
            "organisation_name": "Native Test Cafe",
            "accept_terms": True,
            "client": "mobile",
            "device_label": "Test phone",
        },
    )
    assert response.status_code == 201, response.text
    token = response.json()
    assert token["role"] == "employer" and token["refresh_token"]
    me = (await client.get("/v1/auth/me", headers=auth(token["access_token"]))).json()
    assert len(me["memberships"]) == 1 and me["memberships"][0]["role"] == "owner"
    rotated = await client.post("/v1/auth/refresh", json={"refresh_token": token["refresh_token"]})
    assert rotated.status_code == 200 and rotated.json()["role"] == "employer"
    assert rotated.json()["refresh_token"] != token["refresh_token"]


async def mobile_login(client, email, password=PASSWORD, label="Pixel 9"):
    r = await client.post(
        "/v1/auth/login",
        json={"email": email, "password": password, "client": "mobile", "device_label": label},
    )
    assert r.status_code == 200, r.text
    return r.json()


async def mobile_register(client, email, name="Mobile Person"):
    r = await client.post(
        "/v1/auth/register/candidate",
        json={"email": email, "password": PASSWORD, "full_name": name, "accept_terms": True,
              "client": "mobile", "device_label": "iPhone 17"},
    )  # fmt: skip
    assert r.status_code == 201, r.text
    return r.json()


class FakeSender:
    def __init__(self, dead=()):
        self.sent: list[PushMessage] = []
        self.dead = set(dead)

    async def send(self, messages):
        self.sent += messages
        return [
            PushResult(m.token, ok=m.token not in self.dead, dead=m.token in self.dead)
            for m in messages
        ]


# ---------------- refresh tokens ----------------
async def test_web_clients_get_no_refresh_token_mobile_clients_do(client):
    await register_candidate(client, "w@x.example.com")
    web = await client.post(
        "/v1/auth/login", json={"email": "w@x.example.com", "password": PASSWORD}
    )
    assert web.json()["refresh_token"] is None and web.json()["expires_in"] == 1800
    mob = await mobile_login(client, "w@x.example.com")
    assert len(mob["refresh_token"]) > 40


async def test_refresh_rotates_and_reuse_revokes_the_family(client):
    first = await mobile_register(client, "m@x.example.com")
    r1 = (
        await client.post("/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    ).json()
    assert r1["refresh_token"] != first["refresh_token"]
    assert (await client.get("/v1/auth/me", headers=auth(r1["access_token"]))).status_code == 200
    r2 = (await client.post("/v1/auth/refresh", json={"refresh_token": r1["refresh_token"]})).json()

    # An attacker (or a retried request) replays the first, already-retired token.
    replay = await client.post("/v1/auth/refresh", json={"refresh_token": first["refresh_token"]})
    assert replay.status_code == 401 and replay.json()["error"]["code"] == "refresh_token_reuse"
    # ...which burns the whole family, including the newest legitimate token.
    after = await client.post("/v1/auth/refresh", json={"refresh_token": r2["refresh_token"]})
    assert after.status_code == 401


async def test_refresh_tokens_are_stored_hashed_and_unknown_tokens_rejected(client):
    out = await mobile_register(client, "h@x.example.com")
    async with db_as() as s:
        hashes = [r[0] for r in await s.execute(text("select token_hash from refresh_tokens"))]
    assert out["refresh_token"] not in hashes and all(len(h) == 64 for h in hashes)
    bad = await client.post("/v1/auth/refresh", json={"refresh_token": "x" * 64})
    assert bad.status_code == 401


async def test_refresh_expiry_sliding_and_absolute(client):
    await register_candidate(client, "e@x.example.com")
    await mobile_login(client, "e@x.example.com")
    async with db_as() as s:
        user = (await s.execute(text("select id from users"))).scalar_one()
        u = SimpleNamespace(id=user, is_active=True)
        t0 = datetime.now(UTC)
        raw = await tokens.issue(s, u, "d", now=t0)  # type: ignore[arg-type]
        await s.commit()
    async with db_as() as s:
        from fastapi import HTTPException  # noqa: F401

        from app.errors import ApiError

        with pytest.raises(ApiError):
            await tokens.rotate(s, raw, now=t0 + timedelta(days=31))  # idle too long
        # keep rotating weekly: fine until the 90-day absolute limit
        cur, when = raw, t0
        for _ in range(12):
            when += timedelta(days=7)
            _, cur = await tokens.rotate(s, cur, now=when)
        with pytest.raises(ApiError):
            await tokens.rotate(s, cur, now=t0 + timedelta(days=91))


async def test_logout_logout_all_and_password_change(client):
    first = await mobile_register(client, "l@x.example.com")
    phone = first
    tablet = await mobile_login(client, "l@x.example.com", label="iPad")
    # logout on the phone only
    assert (
        await client.post("/v1/auth/logout", json={"refresh_token": phone["refresh_token"]})
    ).status_code == 204
    assert (
        await client.post("/v1/auth/refresh", json={"refresh_token": phone["refresh_token"]})
    ).status_code == 401
    assert (
        await client.post("/v1/auth/logout", json={"refresh_token": "unknown" * 5})
    ).status_code == 204
    ok = await client.post("/v1/auth/refresh", json={"refresh_token": tablet["refresh_token"]})
    assert ok.status_code == 200
    h = auth(ok.json()["access_token"])
    # wrong current password
    bad = await client.post(
        "/v1/account/password",
        json={"current_password": "nope-nope-nope", "new_password": "a-brand-new-password"},
        headers=h,
    )
    assert bad.status_code == 403
    good = await client.post(
        "/v1/account/password",
        json={"current_password": PASSWORD, "new_password": "a-brand-new-password"},
        headers=h,
    )
    assert good.status_code == 204
    assert (
        await client.post("/v1/auth/refresh", json={"refresh_token": ok.json()["refresh_token"]})
    ).status_code == 401
    assert (
        await client.post("/v1/auth/login", json={"email": "l@x.example.com", "password": PASSWORD})
    ).status_code == 401
    assert (
        await client.post(
            "/v1/auth/login", json={"email": "l@x.example.com", "password": "a-brand-new-password"}
        )
    ).status_code == 200


async def test_disabled_users_cannot_refresh(client):
    out = await mobile_register(client, "d@x.example.com")
    async with db_as() as s:
        await s.execute(text("update users set is_active=false"))
        await s.commit()
    assert (
        await client.post("/v1/auth/refresh", json={"refresh_token": out["refresh_token"]})
    ).status_code == 401


# ---------------- saved jobs ----------------
async def test_saved_jobs_lifecycle_and_isolation(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    job = await published_job(client, emp, eid)
    locs = (await client.get(f"/v1/employers/{eid}/locations", headers=emp)).json()
    draft = (
        await client.post(
            f"/v1/employers/{eid}/jobs", json={**JOB, "location_id": locs[0]["id"]}, headers=emp
        )
    ).json()
    a = await register_candidate(client, "a@x.example.com")
    b = await register_candidate(client, "b@x.example.com")
    url = f"/v1/candidate/saved-jobs/{job['id']}"
    assert (await client.put(url, headers=a)).status_code == 204
    assert (await client.put(url, headers=a)).status_code == 204  # idempotent
    assert (
        await client.put(f"/v1/candidate/saved-jobs/{draft['id']}", headers=a)
    ).status_code == 404
    assert (
        await client.put(f"/v1/candidate/saved-jobs/{uuid.uuid4()}", headers=a)
    ).status_code == 404
    assert (await client.get("/v1/candidate/saved-jobs/ids", headers=a)).json() == [job["id"]]
    listed = (await client.get("/v1/candidate/saved-jobs", headers=a)).json()
    assert (
        len(listed) == 1 and listed[0]["is_open"] is True and listed[0]["job"]["title"] == "Barista"
    )
    assert (await client.get("/v1/candidate/saved-jobs", headers=b)).json() == []
    assert (await client.get("/v1/candidate/saved-jobs", headers=emp)).status_code == 403

    await client.post(f"/v1/employers/{eid}/jobs/{job['id']}/close", headers=emp)
    assert (await client.get("/v1/candidate/saved-jobs", headers=a)).json()[0]["is_open"] is False
    assert (
        await client.delete(url, headers=b)
    ).status_code == 204  # no effect on someone else's save
    assert len((await client.get("/v1/candidate/saved-jobs", headers=a)).json()) == 1
    assert (await client.delete(url, headers=a)).status_code == 204
    assert (await client.get("/v1/candidate/saved-jobs", headers=a)).json() == []


async def test_saved_searches_validation_limits_and_isolation(client):
    a = await register_candidate(client, "a@x.example.com")
    b = await register_candidate(client, "b@x.example.com")
    r = await client.post(
        "/v1/candidate/saved-searches",
        json={"name": "Baristas", "params": {"q": "barista", "suburb": "Fitzroy"}},
        headers=a,
    )
    assert r.status_code == 201 and r.json()["alerts_enabled"] is True
    sid = r.json()["id"]
    bad = await client.post(
        "/v1/candidate/saved-searches", json={"name": "x", "params": {"near_lat": -37.8}}, headers=a
    )
    assert bad.status_code == 422
    unknown = await client.post(
        "/v1/candidate/saved-searches", json={"name": "x", "params": {"bogus": 1}}, headers=a
    )
    assert unknown.status_code == 201 and unknown.json()["params"] == {}  # unknown keys are dropped
    assert (
        await client.patch(
            f"/v1/candidate/saved-searches/{sid}", json={"alerts_enabled": False}, headers=b
        )
    ).status_code == 404
    p = await client.patch(
        f"/v1/candidate/saved-searches/{sid}",
        json={"alerts_enabled": False, "name": "Cafes"},
        headers=a,
    )
    assert p.json()["alerts_enabled"] is False and p.json()["name"] == "Cafes"
    assert (await client.get("/v1/candidate/saved-searches", headers=b)).json() == []
    for i in range(18):
        assert (
            await client.post(
                "/v1/candidate/saved-searches", json={"name": f"s{i}", "params": {}}, headers=a
            )
        ).status_code == 201
    over = await client.post(
        "/v1/candidate/saved-searches", json={"name": "one too many", "params": {}}, headers=a
    )
    assert over.status_code == 409 and over.json()["error"]["code"] == "too_many_searches"
    assert (
        await client.delete(f"/v1/candidate/saved-searches/{sid}", headers=a)
    ).status_code == 204


# ---------------- alerts + push ----------------
async def test_alerts_notify_once_per_batch_of_new_matching_jobs(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    await published_job(client, emp, eid, title="Old Barista")  # published before the search exists
    cand = await register_candidate(client, "c@x.example.com")
    await client.post(
        "/v1/candidate/saved-searches",
        json={"name": "Baristas", "params": {"q": "barista"}},
        headers=cand,
    )
    off = (
        await client.post(
            "/v1/candidate/saved-searches",
            json={"name": "Muted", "params": {"q": "barista"}, "alerts_enabled": False},
            headers=cand,
        )
    ).json()
    assert off["alerts_enabled"] is False
    await published_job(client, emp, eid, title="Lead Barista")
    await published_job(client, emp, eid, title="Chef de Partie", category="Kitchen")  # not a match

    later = datetime.now(UTC) + timedelta(hours=2)
    async with db_as() as s:
        assert (
            await run_alerts(s, now=later - timedelta(hours=1, minutes=59)) == 0
        )  # inside the 1h gap
        assert await run_alerts(s, now=later) == 1
        assert await run_alerts(s, now=later) == 0  # nothing new since
        await s.commit()
    notes = [
        n
        for n in (await client.get("/v1/notifications", headers=cand)).json()
        if n["kind"] == "job.alert"
    ]
    assert len(notes) == 1 and notes[0]["data"]["count"] == 1 and "Lead Barista" in notes[0]["body"]
    assert "1 new job for" in notes[0]["title"]


async def test_push_delivery_rules(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    job = await published_job(client, emp, eid)
    on = await register_candidate(client, "on@x.example.com")
    off = await register_candidate(client, "off@x.example.com")
    bare = await register_candidate(client, "bare@x.example.com")
    for h, tok in (
        (on, "ExponentPushToken[on-device-1]"),
        (off, "ExponentPushToken[off-device-1]"),
    ):
        r = await client.post("/v1/devices", json={"token": tok, "platform": "ios"}, headers=h)
        assert r.status_code == 204
    await client.put(
        "/v1/candidate/notification-settings", json={"push_enabled": False}, headers=off
    )
    for h in (on, off, bare):
        await client.post(f"/v1/jobs/{job['id']}/applications", json={}, headers=h)
    apps = {
        n["data"]["application_id"] for h in (on,) for n in []
    }  # placeholder to keep ids private
    assert apps == set()
    # employer advances each application -> a notification per candidate
    pipeline = (
        await client.get(f"/v1/employers/{eid}/jobs/{job['id']}/applications", headers=emp)
    ).json()
    for a in pipeline:
        await client.post(
            f"/v1/employers/{eid}/applications/{a['application_id']}/status",
            json={"to_status": "under_review"},
            headers=emp,
        )

    sender = FakeSender()
    async with db_as() as s:
        await deliver_pending(s, sender)
        await s.commit()
    candidate_msgs = [m for m in sender.sent if "application" in m.title.lower()]
    assert [m.token for m in candidate_msgs] == [
        "ExponentPushToken[on-device-1]"
    ]  # only opted-in + registered
    assert set(candidate_msgs[0].data) <= {
        "kind",
        "application_id",
        "status",
    }  # no free text in payload
    async with db_as() as s:
        unprocessed = (
            await s.execute(text("select count(*) from notifications where pushed_at is null"))
        ).scalar()
        assert unprocessed == 0
        again = FakeSender()
        assert await deliver_pending(s, again) == 0 and again.sent == []  # never sent twice


async def test_push_skips_stale_and_removes_dead_tokens(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    job = await published_job(client, emp, eid)
    c = await register_candidate(client, "c@x.example.com")
    await client.post(
        "/v1/devices",
        json={"token": "ExponentPushToken[dead-device]", "platform": "android"},
        headers=c,
    )
    await client.post(f"/v1/jobs/{job['id']}/applications", json={}, headers=c)
    app_id = (
        await client.get(f"/v1/employers/{eid}/jobs/{job['id']}/applications", headers=emp)
    ).json()[0]["application_id"]
    await client.post(
        f"/v1/employers/{eid}/applications/{app_id}/status",
        json={"to_status": "under_review"},
        headers=emp,
    )
    async with db_as() as s:  # pretend the notification is two days old
        await s.execute(text("update notifications set created_at = now() - interval '2 days'"))
        await s.commit()
    async with db_as() as s:
        stale = FakeSender()
        assert await deliver_pending(s, stale) == 0
        await s.commit()
    await client.post("/v1/candidate/saved-searches", json={"name": "all", "params": {}}, headers=c)
    await published_job(client, emp, eid, title="Another job")
    async with db_as() as s:
        await run_alerts(s, now=datetime.now(UTC) + timedelta(hours=2))
        dead = FakeSender(dead=["ExponentPushToken[dead-device]"])
        assert await deliver_pending(s, dead) == 1
        left = (await s.execute(text("select count(*) from device_tokens"))).scalar()
        await s.commit()
    assert left == 0  # provider said DeviceNotRegistered -> token deleted


async def test_device_registration_follows_the_latest_sign_in_and_is_private(client):
    a = await register_candidate(client, "a@x.example.com")
    b = await register_candidate(client, "b@x.example.com")
    body = {"token": "ExponentPushToken[shared-phone]", "platform": "ios"}
    assert (await client.post("/v1/devices", json=body, headers=a)).status_code == 204
    assert (
        await client.post("/v1/devices", json=body, headers=b)
    ).status_code == 204  # phone changed hands
    async with db_as() as s:
        owner = (
            await s.execute(
                text("select u.email from device_tokens d join users u on u.id=d.user_id")
            )
        ).scalar()
    assert owner == "b@x.example.com"
    assert (
        await client.request("DELETE", "/v1/devices", json=body, headers=a)
    ).status_code == 204  # not a's: no effect
    async with db_as() as s:
        assert (await s.execute(text("select count(*) from device_tokens"))).scalar() == 1
    assert (await client.request("DELETE", "/v1/devices", json=body, headers=b)).status_code == 204
    async with db_as() as s:
        assert (await s.execute(text("select count(*) from device_tokens"))).scalar() == 0
    assert (
        await client.post("/v1/devices", json={"token": "short", "platform": "ios"}, headers=a)
    ).status_code == 422


async def test_rls_isolates_new_mobile_tables(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    job = await published_job(client, emp, eid)
    a = await register_candidate(client, "a@x.example.com")
    await client.put(f"/v1/candidate/saved-jobs/{job['id']}", headers=a)
    await client.post("/v1/candidate/saved-searches", json={"name": "x", "params": {}}, headers=a)
    await client.post(
        "/v1/devices", json={"token": "ExponentPushToken[a-phone]", "platform": "ios"}, headers=a
    )
    async with db_as(role="") as s:
        for t in ("saved_jobs", "saved_searches", "device_tokens", "refresh_tokens"):
            assert (await s.execute(text(f"select count(*) from {t}"))).scalar() == 0, t  # noqa: S608
    async with db_as(role="employer", employer_ids=[uuid.UUID(eid)]) as s:
        for t in ("saved_jobs", "saved_searches", "device_tokens"):
            assert (await s.execute(text(f"select count(*) from {t}"))).scalar() == 0, t  # noqa: S608


# ---------------- search upgrades ----------------
async def test_near_me_pay_floor_and_sorting(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    for name, suburb, pc in (
        ("Brighton venue", "Brighton", "3186"),
        ("Footscray venue", "Footscray", "3011"),
    ):
        r = await client.post(
            f"/v1/employers/{eid}/locations",
            json={"name": name, "suburb": suburb, "state": "VIC", "postcode": pc},
            headers=emp,
        )
        assert r.status_code == 201
    locs = {
        loc["suburb"]: loc["id"]
        for loc in (await client.get(f"/v1/employers/{eid}/locations", headers=emp)).json()
    }
    await published_job(
        client,
        emp,
        eid,
        title="Fitzroy barista",
        location_id=locs["Fitzroy"],
        pay_min="28",
        pay_max="30",
    )
    await published_job(
        client,
        emp,
        eid,
        title="Brighton barista",
        location_id=locs["Brighton"],
        pay_min="40",
        pay_max="45",
    )
    await published_job(
        client,
        emp,
        eid,
        title="Footscray barista",
        location_id=locs["Footscray"],
        pay_min="85000",
        pay_max="95000",
        pay_period="year",
    )

    cbd = {"near_lat": -37.814, "near_lng": 144.963}
    res = (await client.get("/v1/jobs", params={**cbd, "radius_km": 7, "sort": "distance"})).json()
    titles = [j["title"] for j in res["items"]]
    assert titles == [
        "Fitzroy barista",
        "Footscray barista",
    ]  # Footscray is ~5.5 km, Brighton ~10.7 km away
    assert res["items"][0]["distance_km"] < res["items"][1]["distance_km"] < 7
    everything = (await client.get("/v1/jobs", params={**cbd, "sort": "distance"})).json()["items"]
    assert [j["title"] for j in everything][-1] == "Brighton barista"

    assert [
        j["title"] for j in (await client.get("/v1/jobs", params={"sort": "pay"})).json()["items"]
    ][:2] == ["Footscray barista", "Brighton barista"]  # $48/h beats $45/h
    # $95k/yr ~= $48/hr, so it clears a $46 floor while $30/hr and $45/hr do not
    floor = (await client.get("/v1/jobs", params={"min_hourly": 46})).json()["items"]
    assert [j["title"] for j in floor] == ["Footscray barista"]
    assert (await client.get("/v1/jobs")).json()["items"][0]["distance_km"] is None
    assert (await client.get("/v1/jobs", params={"posted_within_days": 1})).json()["total"] == 3
    assert (await client.get("/v1/jobs", params={"near_lat": -37.8})).status_code == 422
    assert (await client.get("/v1/jobs", params={"sort": "distance"})).status_code == 422
    assert (
        await client.get("/v1/jobs", params={"near_lat": 120, "near_lng": 0})
    ).status_code == 422


# ---------------- account export / deletion ----------------
async def test_export_contains_own_data_and_no_employer_notes_or_secrets(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    job = await published_job(client, emp, eid)
    c = await register_candidate(client, "c@x.example.com", "Cara Candidate")
    await client.post(
        "/v1/candidate/resumes", json={"title": "R", "content_text": "my resume text"}, headers=c
    )
    app = (
        await client.post(
            f"/v1/jobs/{job['id']}/applications", json={"cover_note": "hello"}, headers=c
        )
    ).json()
    await client.post(
        f"/v1/employers/{eid}/applications/{app['id']}/notes",
        json={"note": "INTERNAL-SECRET"},
        headers=emp,
    )
    await client.post(
        f"/v1/employers/{eid}/applications/{app['id']}/status",
        json={"to_status": "rejected", "note": "INTERNAL-REASON"},
        headers=emp,
    )
    await client.post(
        "/v1/devices",
        json={"token": "ExponentPushToken[abc-def-ghi]", "platform": "ios"},
        headers=c,
    )
    r = await client.get("/v1/account/export", headers=c)
    assert r.status_code == 200 and "attachment" in r.headers["content-disposition"]
    body = r.text
    data = r.json()
    assert data["profile"]["full_name"] == "Cara Candidate"
    assert data["resumes"][0]["versions"][0]["content_text"] == "my resume text"
    assert (
        data["applications"][0]["cover_note"] == "hello"
        and len(data["applications"][0]["events"]) == 2
    )
    for secret in (
        "INTERNAL-SECRET",
        "INTERNAL-REASON",
        "ExponentPushToken",
        "password_hash",
        "token_hash",
    ):
        assert secret not in body
    owner_export = (await client.get("/v1/account/export", headers=emp)).json()
    assert owner_export["memberships"] and "profile" not in owner_export


async def test_account_deletion_erases_everything_but_keeps_audit(client):
    emp, eid = await verified_employer(client, "owner@a.example.com")
    job = await published_job(client, emp, eid)
    gone = await mobile_register(client, "gone@x.example.com", "Gone Person")
    stay = await register_candidate(client, "stay@x.example.com", "Stay Person")
    g = auth(gone["access_token"])
    await client.put(
        "/v1/candidate/profile", json={"full_name": "Gone Person", "skills": ["Barista"]}, headers=g
    )
    await client.post(
        "/v1/candidate/resumes", json={"title": "R", "content_text": "gone resume"}, headers=g
    )
    await client.put(f"/v1/candidate/saved-jobs/{job['id']}", headers=g)
    await client.post("/v1/candidate/saved-searches", json={"name": "x", "params": {}}, headers=g)
    await client.post(
        "/v1/devices",
        json={"token": "ExponentPushToken[gone-phone]", "platform": "android"},
        headers=g,
    )
    for h in (g, stay):
        await client.post(f"/v1/jobs/{job['id']}/applications", json={}, headers=h)

    assert (
        await client.request(
            "DELETE", "/v1/account", json={"password": "wrong-password-1"}, headers=g
        )
    ).status_code == 403
    assert (
        await client.request("DELETE", "/v1/account", json={"password": PASSWORD}, headers=emp)
    ).status_code == 409  # businesses go via support
    assert (
        await client.request("DELETE", "/v1/account", json={"password": PASSWORD}, headers=g)
    ).status_code == 204

    assert (await client.get("/v1/auth/me", headers=g)).status_code == 401
    assert (
        await client.post(
            "/v1/auth/login", json={"email": "gone@x.example.com", "password": PASSWORD}
        )
    ).status_code == 401
    assert (
        await client.post("/v1/auth/refresh", json={"refresh_token": gone["refresh_token"]})
    ).status_code == 401
    pipeline = (
        await client.get(f"/v1/employers/{eid}/jobs/{job['id']}/applications", headers=emp)
    ).json()
    assert [a["full_name"] for a in pipeline] == ["Stay Person"]
    async with db_as() as s:
        for table in (
            "users",
            "candidate_profiles",
            "resumes",
            "saved_jobs",
            "saved_searches",
            "device_tokens",
            "refresh_tokens",
            "applications",
        ):
            n = (
                await s.execute(
                    text(f"select count(*) from {table} where {_owner_filter(table)}")  # noqa: S608
                )
            ).scalar()
            assert n == 0, table
        assert (
            await s.execute(
                text("select count(*) from audit_events where action='account.deleted'")
            )
        ).scalar() == 1
        assert (
            await s.execute(text("select count(*) from users where email='stay@x.example.com'"))
        ).scalar() == 1
    assert (await client.get("/v1/candidate/applications", headers=stay)).json()[0][
        "status"
    ] == "submitted"


def _owner_filter(table: str) -> str:
    return {
        "users": "email = 'gone@x.example.com'",
        "candidate_profiles": "full_name = 'Gone Person'",
        "resumes": "title = 'R' and candidate_id not in (select id from candidate_profiles)",
        "saved_jobs": "candidate_id not in (select id from candidate_profiles)",
        "saved_searches": "candidate_id not in (select id from candidate_profiles)",
        "device_tokens": "user_id not in (select id from users)",
        "refresh_tokens": "user_id not in (select id from users)",
        "applications": "candidate_id not in (select id from candidate_profiles)",
    }[table]


async def test_worker_pass_reports_alerts_and_pushes(client):
    from app.worker import run_once

    stats = await run_once()
    assert "alerts" in stats and "pushed" in stats


async def test_cors_allows_the_methods_web_clients_use(client):
    """The mobile web build calls PATCH (saved-search edits) cross-origin; preflight must allow it."""
    r = await client.options(
        "/v1/candidate/saved-searches/00000000-0000-0000-0000-000000000000",
        headers={"Origin": "http://localhost:8081", "Access-Control-Request-Method": "PATCH",
                 "Access-Control-Request-Headers": "authorization,content-type"},
    )  # fmt: skip
    assert r.status_code == 200
    assert "PATCH" in r.headers["access-control-allow-methods"]
    assert r.headers["access-control-allow-origin"] == "http://localhost:8081"
    evil = await client.options(
        "/v1/candidate/saved-searches/x",
        headers={"Origin": "https://evil.example.com", "Access-Control-Request-Method": "PATCH"},
    )
    assert "access-control-allow-origin" not in evil.headers
