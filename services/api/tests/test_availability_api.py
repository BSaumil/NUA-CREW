"""M1: work preferences, availability, commitments, employer preferences, consent-based talent
search. Real Postgres with RLS enforced for the runtime role."""

import json
from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from tests.conftest import (
    db_as,
    published_job,
    register_candidate,
    register_employer,
    verified_employer,
)

PERM = {
    "enabled": True,
    "engagement_bases": ["employee"],
    "hours_patterns": ["full_time"],
    "min_hourly_pay": "40.00",
    "notice_period_days": 28,
    "available_from": "2027-02-01",
}
TEMP = {
    "enabled": True,
    "engagement_bases": ["employee"],
    "hours_patterns": ["casual"],
    "min_hourly_pay": "30.00",
    "max_travel_km": 15,
}
TUE = (2026, 11, 3)  # a Tuesday in Melbourne


def mel(y, m, d, hh, mm=0):
    from zoneinfo import ZoneInfo

    return datetime(y, m, d, hh, mm, tzinfo=ZoneInfo("Australia/Melbourne"))


def iso(dt):
    return dt.astimezone(UTC).isoformat()


async def put_pref(client, h, kind, body):
    r = await client.put(f"/v1/candidate/work-preferences/{kind}", json=body, headers=h)
    assert r.status_code == 200, r.text
    return r.json()


async def discoverable_candidate(client, email, name, kinds=("temporary",), suburb="Fitzroy"):
    h = await register_candidate(client, email, name)
    r = await client.put(
        "/v1/candidate/profile",
        json={
            "full_name": name,
            "headline": "Barista with 5 years",
            "suburb": suburb,
            "state": "VIC",
            "postcode": "3065",
            "skills": ["Barista"],
            "preferred_employment_types": ["casual"],
        },
        headers=h,
    )
    assert r.status_code == 200, r.text
    assert (
        await client.put(
            "/v1/candidate/consents/talent-discovery", json={"granted": True}, headers=h
        )
    ).status_code == 200
    for k in kinds:
        await put_pref(client, h, k, PERM if k == "permanent" else TEMP)
        r = await client.put(
            f"/v1/candidate/consents/discovery/{k}", json={"granted": True}, headers=h
        )
        assert r.status_code == 200, r.text
    return h


async def set_weekly(client, h, rules, tz="Australia/Melbourne"):
    r = await client.put(
        "/v1/candidate/availability/rules", json={"time_zone": tz, "rules": rules}, headers=h
    )
    assert r.status_code == 200, r.text
    return r.json()


def window(wd, s, e):
    return {"weekday": wd, "start_time": s, "end_time": e}


async def search(client, h, eid, **body):
    body.setdefault("kind", "temporary")
    return await client.post(f"/v1/employers/{eid}/talent/search", json=body, headers=h)


# ---- 1. Both / toggling -------------------------------------------------------------------
async def test_both_keeps_each_preference_set_and_off_does_not_erase(client):
    h = await register_candidate(client, "both@nua-crew.example.com")
    first = await client.get("/v1/candidate/work-preferences", headers=h)
    assert first.json() == {"permanent": None, "temporary": None}  # never set != set but off

    await put_pref(client, h, "permanent", PERM)
    await put_pref(client, h, "temporary", TEMP)
    both = (await client.get("/v1/candidate/work-preferences", headers=h)).json()
    assert both["permanent"]["notice_period_days"] == 28
    assert both["temporary"]["max_travel_km"] == 15
    assert both["permanent"]["max_travel_km"] is None  # no bleed between kinds

    # Updating temporary never touches permanent.
    await put_pref(client, h, "temporary", {**TEMP, "max_travel_km": 30})
    again = (await client.get("/v1/candidate/work-preferences", headers=h)).json()
    assert again["permanent"] == both["permanent"]

    # Turning permanent off keeps its fields and leaves temporary on.
    await put_pref(client, h, "permanent", {**PERM, "enabled": False})
    off = (await client.get("/v1/candidate/work-preferences", headers=h)).json()
    assert off["permanent"]["enabled"] is False
    assert off["permanent"]["notice_period_days"] == 28
    assert off["permanent"]["available_from"] == "2027-02-01"
    assert off["temporary"]["enabled"] is True


async def test_turning_a_kind_off_withdraws_its_discovery_consent_and_asks_again(client):
    h = await discoverable_candidate(client, "wd@nua-crew.example.com", "Wren Dale")
    r = await put_pref(client, h, "temporary", {**TEMP, "enabled": False})
    assert r["discoverable"] is False
    on = await put_pref(client, h, "temporary", TEMP)  # re-enabling does NOT silently re-consent
    assert on["discoverable"] is False
    # and consent can't be granted for a kind that is off
    await put_pref(client, h, "temporary", {**TEMP, "enabled": False})
    r = await client.put(
        "/v1/candidate/consents/discovery/temporary", json={"granted": True}, headers=h
    )
    assert r.status_code == 409 and r.json()["error"]["code"] == "kind_not_enabled"


async def test_preference_validation(client):
    h = await register_candidate(client, "val@nua-crew.example.com")
    bad = [
        {**TEMP, "min_weekly_hours": "30", "max_weekly_hours": "10"},
        {**TEMP, "engagement_bases": ["gig"]},
        {**TEMP, "notice_period_days": 999},
        {**TEMP, "min_hourly_pay": "-1"},
    ]
    for b in bad:
        r = await client.put("/v1/candidate/work-preferences/temporary", json=b, headers=h)
        assert r.status_code == 422, b
    r = await client.put("/v1/candidate/work-preferences/shift", json=TEMP, headers=h)
    assert r.status_code == 422  # a shift is not a kind of employment


# ---- 2/3/4. Availability ------------------------------------------------------------------
async def test_weekly_windows_exceptions_and_unknown(client):
    h = await register_candidate(client, "avail@nua-crew.example.com")
    q = lambda s, e: client.get(  # noqa: E731
        "/v1/candidate/availability/check",
        params={"starts_at": iso(s), "ends_at": iso(e)},
        headers=h,
    )
    # nothing shared -> unknown, never available
    r = (await q(mel(*TUE, 10), mel(*TUE, 12))).json()
    assert r["state"] == "unknown"

    # split shift with a break, plus a Saturday overnight window
    await set_weekly(
        client,
        h,
        [window(1, "09:00", "12:00"), window(1, "14:00", "18:00"), window(5, "22:00", "06:00")],
    )
    assert (await q(mel(*TUE, 9), mel(*TUE, 12))).json()["state"] == "available"
    assert (await q(mel(*TUE, 11), mel(*TUE, 15))).json()["state"] == "unavailable"  # the break
    assert (await q(mel(2026, 11, 7, 23), mel(2026, 11, 8, 5))).json()["state"] == "available"

    # an explicit unavailable exception beats the recurring window
    r = await client.post(
        "/v1/candidate/availability/exceptions",
        json={"state": "unavailable", "start_date": "2026-11-03", "end_date": "2026-11-03"},
        headers=h,
    )
    assert r.status_code == 201
    x_id = r.json()["id"]
    assert (await q(mel(*TUE, 9), mel(*TUE, 12))).json()["state"] == "unavailable"
    assert (
        await client.delete(f"/v1/candidate/availability/exceptions/{x_id}", headers=h)
    ).status_code == 204
    assert (await q(mel(*TUE, 9), mel(*TUE, 12))).json()["state"] == "available"

    # a temporary available exception on a day with no rule
    await client.post(
        "/v1/candidate/availability/exceptions",
        json={"state": "available", "start_date": "2026-11-04", "end_date": "2026-11-04",
              "start_time": "10:00", "end_time": "14:00"},
        headers=h,
    )  # fmt: skip
    assert (await q(mel(2026, 11, 4, 10), mel(2026, 11, 4, 14))).json()["state"] == "available"
    assert (await q(mel(2026, 11, 4, 9), mel(2026, 11, 4, 14))).json()["state"] == "unavailable"


async def test_overlapping_windows_and_bad_zone_rejected(client):
    h = await register_candidate(client, "ov@nua-crew.example.com")
    r = await client.put(
        "/v1/candidate/availability/rules",
        json={"time_zone": "Australia/Melbourne",
              "rules": [window(1, "09:00", "12:00"), window(1, "11:00", "13:00")]},
        headers=h,
    )  # fmt: skip
    assert r.status_code == 422 and r.json()["error"]["code"] == "overlapping_windows"
    r = await client.put(
        "/v1/candidate/availability/rules",
        json={"time_zone": "Mars/Olympus", "rules": []},
        headers=h,
    )
    assert r.status_code == 422


async def test_permanent_start_date_is_separate_from_tonights_availability(client):
    h = await register_candidate(client, "np@nua-crew.example.com")
    await put_pref(client, h, "permanent", PERM)  # available from 2027-02-01, 28 days notice
    await set_weekly(client, h, [window(1, "17:00", "23:00")])
    r = await client.get(
        "/v1/candidate/availability/check",
        params={"starts_at": iso(mel(*TUE, 18)), "ends_at": iso(mel(*TUE, 22))},
        headers=h,
    )
    assert r.json()["state"] == "available"  # can work a shift tonight...
    prefs = (await client.get("/v1/candidate/work-preferences", headers=h)).json()
    assert (
        prefs["permanent"]["available_from"] == "2027-02-01"
    )  # ...yet starts a permanent job later


# ---- 5. Commitments -----------------------------------------------------------------------
async def test_confirmed_commitments_conflict_but_applications_do_not_reserve(client):
    h = await register_candidate(client, "commit@nua-crew.example.com")
    await set_weekly(client, h, [window(1, "09:00", "18:00")])
    body = {"starts_at": iso(mel(*TUE, 10)), "ends_at": iso(mel(*TUE, 14)), "status": "confirmed"}
    assert (
        await client.post("/v1/candidate/availability/commitments", json=body, headers=h)
    ).status_code == 201
    clash = await client.post(
        "/v1/candidate/availability/commitments",
        json={**body, "starts_at": iso(mel(*TUE, 13)), "ends_at": iso(mel(*TUE, 16))},
        headers=h,
    )
    assert clash.status_code == 409 and clash.json()["error"]["code"] == "commitment_conflict"
    # back to back is fine
    ok = await client.post(
        "/v1/candidate/availability/commitments",
        json={**body, "starts_at": iso(mel(*TUE, 14)), "ends_at": iso(mel(*TUE, 16))},
        headers=h,
    )
    assert ok.status_code == 201
    chk = (
        await client.get(
            "/v1/candidate/availability/check",
            params={"starts_at": iso(mel(*TUE, 10)), "ends_at": iso(mel(*TUE, 11))},
            headers=h,
        )
    ).json()
    assert chk["state"] == "confirmed"

    # held can overlap, but cannot be confirmed over a confirmed commitment
    held = await client.post(
        "/v1/candidate/availability/commitments",
        json={
            **body,
            "status": "held",
            "starts_at": iso(mel(*TUE, 11)),
            "ends_at": iso(mel(*TUE, 12)),
        },
        headers=h,
    )
    assert held.status_code == 201
    r = await client.post(
        f"/v1/candidate/availability/commitments/{held.json()['id']}/confirm", headers=h
    )
    assert r.status_code == 409

    # An application never reserves the worker.
    eh, eid = await verified_employer(client, "own-commit@nua-crew.example.com", "Commit Cafe")
    job = await published_job(client, eh, eid)
    before = (await client.get("/v1/candidate/availability", headers=h)).json()["commitments"]
    r = await client.post(
        f"/v1/jobs/{job['id']}/applications", json={"cover_note": "hi"}, headers=h
    )
    assert r.status_code == 201, r.text
    after = (await client.get("/v1/candidate/availability", headers=h)).json()["commitments"]
    assert [c["id"] for c in after] == [c["id"] for c in before]


# ---- 6. Privacy ---------------------------------------------------------------------------
async def test_private_data_is_not_readable_by_others_or_by_employers_directly(client):
    a = await discoverable_candidate(client, "pa@nua-crew.example.com", "Pat Ash")
    b = await register_candidate(client, "pb@nua-crew.example.com", "Bo Birch")
    await set_weekly(client, a, [window(1, "09:00", "17:00")])
    # another candidate sees none of it
    assert (await client.get("/v1/candidate/work-preferences", headers=b)).json() == {
        "permanent": None, "temporary": None,
    }  # fmt: skip
    assert (await client.get("/v1/candidate/availability", headers=b)).json()["rules"] == []
    # employers cannot use candidate endpoints at all
    eh, _ = await verified_employer(client, "pe@nua-crew.example.com", "Priv Cafe")
    for path in ("work-preferences", "availability", "employer-preferences"):
        assert (await client.get(f"/v1/candidate/{path}", headers=eh)).status_code == 403
    # and Postgres itself returns nothing to an employer session or another candidate
    async with db_as("employer", employer_ids=[]) as s:
        counts = {
            "work_preferences": "select count(*) from work_preferences",
            "availability_rules": "select count(*) from availability_rules",
            "availability_exceptions": "select count(*) from availability_exceptions",
            "commitments": "select count(*) from commitments",
            "employer_preferences": "select count(*) from employer_preferences",
        }
        for t, sql in counts.items():
            assert (await s.execute(text(sql))).scalar_one() == 0, t
    async with db_as("candidate") as s:  # candidate identity bound to nobody
        assert (await s.execute(text("select count(*) from work_preferences"))).scalar_one() == 0


# ---- 7. Discovery ------------------------------------------------------------------------
async def test_discovery_needs_consent_and_a_verified_member(client):
    eh, eid = await verified_employer(client, "disc@nua-crew.example.com", "Disc Cafe")
    # Complete profile + skills but no consent anywhere
    h = await register_candidate(client, "nc@nua-crew.example.com", "No Consent")
    await client.put(
        "/v1/candidate/profile",
        json={"full_name": "No Consent", "headline": "Barista", "suburb": "Fitzroy", "state": "VIC",
              "postcode": "3065", "skills": ["Barista"]},
        headers=h,
    )  # fmt: skip
    await put_pref(client, h, "temporary", TEMP)  # enabled but not discoverable
    assert (await search(client, eh, eid)).json()["items"] == []

    # master on, kind not consented -> still hidden
    await client.put("/v1/candidate/consents/talent-discovery", json={"granted": True}, headers=h)
    assert (await search(client, eh, eid)).json()["items"] == []
    # kind consented but master off -> hidden
    await client.put(
        "/v1/candidate/consents/discovery/temporary", json={"granted": True}, headers=h
    )
    assert len((await search(client, eh, eid)).json()["items"]) == 1
    await client.put("/v1/candidate/consents/talent-discovery", json={"granted": False}, headers=h)
    assert (await search(client, eh, eid)).json()["items"] == []
    # the other kind was never consented
    await client.put("/v1/candidate/consents/talent-discovery", json={"granted": True}, headers=h)
    assert (await search(client, eh, eid, kind="permanent")).json()["items"] == []

    # unverified employer, non-member, viewer
    uh, ueid = await register_employer(client, "unv@nua-crew.example.com", "Unverified Cafe")
    assert (await search(client, uh, ueid)).status_code == 403
    assert (await search(client, eh, ueid)).status_code == 404  # not a member -> looks missing
    assert (await search(client, h, eid)).status_code == 404  # a candidate is no member
    assert (
        await client.post(f"/v1/employers/{eid}/talent/search", json={"kind": "temporary"})
    ).status_code == 401


async def test_results_are_a_privacy_whitelist(client):
    eh, eid = await verified_employer(client, "wl@nua-crew.example.com", "White Cafe")
    h = await discoverable_candidate(client, "wlc@nua-crew.example.com", "Casey Lee Fernandez")
    await set_weekly(client, h, [window(1, "09:00", "17:00")])
    await client.post(
        "/v1/candidate/availability/commitments",
        json={"starts_at": iso(mel(*TUE, 9)), "ends_at": iso(mel(*TUE, 10)), "status": "confirmed",
              "label": "Secret second job"},
        headers=h,
    )  # fmt: skip
    r = await search(client, eh, eid, starts_at=iso(mel(*TUE, 12)), ends_at=iso(mel(*TUE, 14)))
    assert r.status_code == 200, r.text
    raw = r.text
    item = r.json()["items"][0]
    assert item["display_name"] == "Casey F."
    assert item["area"] == "Fitzroy, VIC"
    assert item["availability"]["state"] == "available"
    assert r.json()["invite_available"] is True and r.json()["invite_unavailable_reason"] is None
    for secret in ("40.00", "30.00", "min_hourly_pay", "Secret second job", "commitment",
                   "wlc@nua-crew", "postcode", "3065", "max_travel_km"):  # fmt: skip
        assert secret not in raw, secret
    # the opaque ref is not the account id and differs between employers
    eh2, eid2 = await verified_employer(client, "wl2@nua-crew.example.com", "Other Cafe")
    other = (await search(client, eh2, eid2)).json()["items"][0]["ref"]
    assert item["ref"] != other and len(item["ref"]) == 24
    # held/confirmed/unavailable collapse to one generic answer and are excluded by default
    busy = await search(client, eh, eid, starts_at=iso(mel(*TUE, 9)), ends_at=iso(mel(*TUE, 10)))
    assert busy.json()["items"] == []
    anyway = await search(
        client, eh, eid, starts_at=iso(mel(*TUE, 9)), ends_at=iso(mel(*TUE, 10)), availability="any"
    )
    only = anyway.json()["items"][0]["availability"]
    assert only == {"state": "unavailable", "reason": "Not available for this time"}


async def test_unknown_availability_is_labelled_unknown_and_explained(client):
    eh, eid = await verified_employer(client, "unk@nua-crew.example.com", "Unk Cafe")
    await discoverable_candidate(client, "unkc@nua-crew.example.com", "Uma Kay")  # no availability
    r = await search(
        client,
        eh,
        eid,
        starts_at=iso(mel(*TUE, 12)),
        ends_at=iso(mel(*TUE, 14)),
        min_weekly_hours="20",
    )
    item = r.json()["items"][0]
    assert item["availability"]["state"] == "unknown"
    assert item["hours_compat"] == "unknown"
    assert "Availability not shared" in item["unknowns"]


async def test_pay_fit_never_reveals_the_floor(client):
    eh, eid = await verified_employer(client, "pay@nua-crew.example.com", "Pay Cafe")
    await discoverable_candidate(client, "payc@nua-crew.example.com", "Pia Cole")  # floor $30/h
    ok = await published_job(client, eh, eid, pay_min="30", pay_max="35")
    low = await published_job(client, eh, eid, title="Dishie", pay_min="20", pay_max="24")
    none = await published_job(
        client, eh, eid, title="Mystery", pay_min=None, pay_max=None, pay_period=None
    )  # noqa: E501
    got = {}
    for name, job in (("ok", ok), ("low", low), ("none", none)):
        item = (await search(client, eh, eid, job_id=job["id"])).json()["items"][0]
        got[name] = (item["pay_compat"], item["unknowns"])
    assert got["ok"][0] == "compatible"
    assert got["low"][0] == "not_confirmed" and got["low"][1] == ["Pay fit not confirmed"]
    assert got["none"][0] == "not_confirmed"
    # another employer's job id is invisible
    oh, oeid = await verified_employer(client, "pay2@nua-crew.example.com", "Pay2 Cafe")
    theirs = await published_job(client, oh, oeid)
    assert (await search(client, eh, eid, job_id=theirs["id"])).status_code == 404


async def test_search_is_audited_with_who_was_shown_and_is_rate_limited(client, monkeypatch):
    from app.config import get_settings

    eh, eid = await verified_employer(client, "aud@nua-crew.example.com", "Aud Cafe")
    await discoverable_candidate(client, "audc@nua-crew.example.com", "Ana Uy")
    assert (await search(client, eh, eid, suburb="Fitzroy")).status_code == 200
    async with db_as("system") as s:
        row = (
            await s.execute(text("select metadata from audit_events where action='talent.search'"))
        ).scalar_one()
    assert row["kind"] == "temporary" and len(row["shown_candidate_ids"]) == 1
    assert "audc@nua-crew" not in json.dumps(row)
    monkeypatch.setattr(get_settings(), "talent_search_limit_per_hour", 2)
    codes = [(await search(client, eh, eid)).status_code for _ in range(3)]
    assert 429 in codes


# ---- 8. Employer preferences --------------------------------------------------------------
async def test_hide_follow_and_mute(client):
    eh, eid = await verified_employer(client, "pref@nua-crew.example.com", "Pref Cafe")
    other_h, other_id = await verified_employer(client, "pref2@nua-crew.example.com", "Pref Bar")
    h = await discoverable_candidate(client, "prefc@nua-crew.example.com", "Quin Rae")

    dirr = await client.get("/v1/candidate/employer-directory", params={"q": "Pref"}, headers=h)
    assert {e["id"] for e in dirr.json()} == {eid, other_id}

    # follow: a label only
    r = await client.post(
        "/v1/candidate/employer-preferences", json={"employer_id": eid, "kind": "follow"}, headers=h
    )
    assert r.status_code == 201
    item = (await search(client, eh, eid)).json()["items"][0]
    assert item["prefers_your_business"] is True
    assert (await search(client, other_h, other_id)).json()["items"][0][
        "prefers_your_business"
    ] is False

    # hide_from replaces follow for that employer and removes the candidate from its results only
    r = await client.post(
        "/v1/candidate/employer-preferences",
        json={"employer_id": eid, "kind": "hide_from"},
        headers=h,
    )
    assert r.status_code == 201
    assert (await search(client, eh, eid)).json()["items"] == []
    assert len((await search(client, other_h, other_id)).json()["items"]) == 1
    prefs = (await client.get("/v1/candidate/employer-preferences", headers=h)).json()
    assert [p["kind"] for p in prefs] == ["hide_from"]
    # employers can never read preferences (not even their own mention)
    assert (await client.get("/v1/candidate/employer-preferences", headers=eh)).status_code == 403
    # removing the preference restores discovery
    assert (
        await client.delete(f"/v1/candidate/employer-preferences/{prefs[0]['id']}", headers=h)
    ).status_code == 204
    assert len((await search(client, eh, eid)).json()["items"]) == 1

    # mute hides that employer's jobs from this candidate only
    job = await published_job(client, eh, eid)
    anon = await client.get("/v1/jobs")
    assert job["id"] in {j["id"] for j in anon.json()["items"]}
    await client.post(
        "/v1/candidate/employer-preferences", json={"employer_id": eid, "kind": "mute"}, headers=h
    )
    mine = await client.get("/v1/jobs", headers=h)
    assert job["id"] not in {j["id"] for j in mine.json()["items"]}
    other = await register_candidate(client, "prefo@nua-crew.example.com", "Other One")
    theirs = await client.get("/v1/jobs", headers=other)
    assert job["id"] in {j["id"] for j in theirs.json()["items"]}


async def test_a_candidate_cannot_delete_someone_elses_rows(client):
    a = await register_candidate(client, "xa@nua-crew.example.com", "Xa One")
    b = await register_candidate(client, "xb@nua-crew.example.com", "Xb Two")
    _, eid = await verified_employer(client, "xe@nua-crew.example.com", "X Cafe")
    pref = (
        await client.post(
            "/v1/candidate/employer-preferences",
            json={"employer_id": eid, "kind": "mute"},
            headers=a,
        )
    ).json()
    assert (
        await client.delete(f"/v1/candidate/employer-preferences/{pref['id']}", headers=b)
    ).status_code == 404
    c = (
        await client.post(
            "/v1/candidate/availability/commitments",
            json={"starts_at": iso(mel(*TUE, 9)), "ends_at": iso(mel(*TUE, 10))},
            headers=a,
        )
    ).json()
    assert (
        await client.delete(f"/v1/candidate/availability/commitments/{c['id']}", headers=b)
    ).status_code == 404


# ---- jobs: employment basis / duration / schedule are separate ----------------------------
async def test_job_facets_are_separate_and_default_to_unspecified(client):
    eh, eid = await verified_employer(client, "jf@nua-crew.example.com", "Facet Cafe")
    plain = await published_job(client, eh, eid)
    assert (plain["engagement_basis"], plain["duration_type"], plain["hours_pattern"]) == (
        "unspecified", "unspecified", "unspecified",
    )  # fmt: skip
    rich = await published_job(
        client, eh, eid, title="Cover", employment_type="shift", engagement_basis="employee",
        duration_type="fixed_term", hours_pattern="casual", min_weekly_hours="10",
        max_weekly_hours="20", start_date="2027-01-04", end_date="2027-03-26",
    )  # fmt: skip
    assert rich["employment_type"] == "shift" and rich["duration_type"] == "fixed_term"
    got = await client.get("/v1/jobs", params={"duration_type": "fixed_term"})
    assert [j["id"] for j in got.json()["items"]] == [rich["id"]]
    bad = await client.post(
        f"/v1/employers/{eid}/jobs",
        json={**plain, "start_date": "2027-05-01", "end_date": "2027-01-01", "skills": []},
        headers=eh,
    )
    assert bad.status_code == 422


async def test_export_includes_and_deletion_removes_the_new_private_data(client):
    h = await discoverable_candidate(client, "exp@nua-crew.example.com", "Eli Xu")
    await set_weekly(client, h, [window(1, "09:00", "12:00")])
    _, eid = await verified_employer(client, "expe@nua-crew.example.com", "Exp Cafe")
    await client.post(
        "/v1/candidate/employer-preferences", json={"employer_id": eid, "kind": "mute"}, headers=h
    )
    data = (await client.get("/v1/account/export", headers=h)).json()
    assert data["work_preferences"][0]["kind"] == "temporary"
    assert len(data["availability"]["rules"]) == 1
    assert data["employer_preferences"] == [{"employer": "Exp Cafe", "kind": "mute"}]
    r = await client.request(
        "DELETE", "/v1/account", json={"password": "correct-horse-battery"}, headers=h
    )
    assert r.status_code == 204, r.text
    async with db_as("system") as s:
        for sql in (
            "select count(*) from work_preferences",
            "select count(*) from availability_rules",
            "select count(*) from employer_preferences",
        ):
            assert (await s.execute(text(sql))).scalar_one() == 0, sql


async def test_commitment_in_local_time_resolves_in_the_candidates_zone(client):
    h = await register_candidate(client, "loc@nua-crew.example.com")
    r = await client.post(
        "/v1/candidate/availability/commitments",
        json={"local_date": "2026-10-03", "local_start": "22:00", "local_end": "06:00"},
        headers=h,
    )  # Saturday night into Sunday, across the Melbourne DST change
    assert r.status_code == 201, r.text
    c = r.json()
    start = datetime.fromisoformat(c["starts_at"])
    end = datetime.fromisoformat(c["ends_at"])
    assert (end - start) == timedelta(hours=7)  # real elapsed time that night
    assert start.astimezone(UTC).isoformat().startswith("2026-10-03T12:00")  # 22:00 AEST
    for bad in (
        {"local_date": "2026-10-03", "local_start": "22:00"},
        {"local_date": "2026-10-03", "local_start": "09:00", "local_end": "09:00"},
        {"starts_at": "2026-10-03T22:00:00+10:00", "local_date": "2026-10-03"},
        {},
    ):
        r = await client.post("/v1/candidate/availability/commitments", json=bad, headers=h)
        assert r.status_code == 422, bad


async def test_search_window_can_be_given_in_the_venues_local_time(client):
    eh, eid = await verified_employer(client, "lw@nua-crew.example.com", "Local Cafe")
    h = await discoverable_candidate(client, "lwc@nua-crew.example.com", "Lia Wu")
    await set_weekly(client, h, [window(5, "22:00", "06:00")])  # Saturday night into Sunday
    body = {"window_date": "2026-10-03", "window_start": "22:00", "window_end": "06:00"}
    got = await search(client, eh, eid, **body)  # the Melbourne DST-start night
    assert got.status_code == 200, got.text
    assert got.json()["items"][0]["availability"]["state"] == "available"
    for bad in (
        {"window_date": "2026-10-03"},
        {**body, "starts_at": "2026-10-03T22:00:00+10:00", "ends_at": "2026-10-04T06:00:00+11:00"},
        {**body, "window_time_zone": "Mars/Olympus"},
        {**body, "window_end": "22:00"},
    ):
        assert (await search(client, eh, eid, **bad)).status_code == 422, bad
