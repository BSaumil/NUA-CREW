"""Phases B-D: hiring invitations, consent-based messaging, quotas, notifications, privacy.
Real Postgres with RLS enforced for the runtime role."""

import asyncio
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import text

from app.config import get_settings
from app.services import push
from tests.conftest import (
    db_as,
    published_job,
    register_candidate,
    register_employer,
    verified_employer,
)
from tests.test_availability_api import discoverable_candidate, search

KEY = "Idempotency-Key"


async def test_status_filter_applies_before_limit_for_both_sides(client):
    from app.models import Invitation

    eh, eid, job, ch, ref = await setup_pair(client, "filter-order")
    inv = (await send(client, eh, eid, body(ref, job))).json()
    async with db_as("system") as session:
        original = await session.get(Invitation, uuid.UUID(inv["id"]))
        original.created_at = datetime.now(UTC) - timedelta(hours=1)
        session.add(
            Invitation(
                employer_id=original.employer_id,
                candidate_id=original.candidate_id,
                job_id=original.job_id,
                kind=original.kind,
                status="declined",
                job_version=original.job_version,
                snapshot=original.snapshot,
                expires_at=original.expires_at,
            )
        )
        await session.commit()
    for url, headers in [
        ("/v1/candidate/invitations", ch),
        (f"/v1/employers/{eid}/invitations", eh),
    ]:
        result = await client.get(url, headers=headers, params={"status": "pending", "limit": 1})
        assert result.status_code == 200
        rows = result.json()["items"] if headers is ch else result.json()
        assert [r["id"] for r in rows] == [inv["id"]]


async def setup_pair(client, tag, name="Ana Brown", kinds=("temporary",)):
    """A verified employer with an open job, and a consenting candidate it has just found."""
    eh, eid = await verified_employer(client, f"emp-{tag}@nua-crew.example.com", f"Cafe {tag}")
    job = await published_job(client, eh, eid)
    suburb = f"Sub{tag}"  # unique so each test pair finds exactly its own candidate
    ch = await discoverable_candidate(
        client, f"cand-{tag}@nua-crew.example.com", name, kinds, suburb=suburb
    )
    found = (await search(client, eh, eid, kind=kinds[0], suburb=suburb)).json()["items"]
    assert len(found) == 1, found
    return eh, eid, job, ch, found[0]["ref"]


def body(ref, job, **over):
    return {"ref": ref, "job_id": job["id"], "kind": "temporary", "note": "Join our team?", **over}


async def send(client, eh, eid, payload, key=None):
    headers = {**eh, **({KEY: key} if key else {})}
    return await client.post(f"/v1/employers/{eid}/invitations", json=payload, headers=headers)


async def inbox(client, ch):
    return (await client.get("/v1/candidate/invitations", headers=ch)).json()


async def accept(client, ch, inv_id, terms_hash=None):
    if terms_hash is None:
        terms_hash = (await client.get(f"/v1/candidate/invitations/{inv_id}", headers=ch)).json()[
            "current_terms_hash"
        ]
    return await client.post(
        f"/v1/candidate/invitations/{inv_id}/accept", json={"terms_hash": terms_hash}, headers=ch
    )


async def backdate(inv_id, **cols):
    sets = ", ".join(f"{k} = :{k}" for k in cols)
    async with db_as("system") as s:
        await s.execute(text(f"UPDATE invitations SET {sets} WHERE id = :i"), {**cols, "i": inv_id})  # noqa: S608
        await s.commit()


# 1 ---------------------------------------------------------------- happy path
async def test_verified_employer_invites_consenting_candidate_who_accepts_and_chats(client):
    eh, eid, job, ch, ref = await setup_pair(client, "happy")
    r = await send(client, eh, eid, body(ref, job))
    assert r.status_code == 201, r.text
    sent = r.json()
    assert sent["status"] == "pending" and sent["candidate_label"] == "Ana B."
    assert sent["candidate_ref"] == ref

    got = await inbox(client, ch)
    assert got["unread"] == 1 and len(got["items"]) == 1
    inv = got["items"][0]
    assert inv["terms"]["business"] == "Cafe happy" and inv["terms"]["pay_basis"] == "disclosed"
    assert inv["note"] == "Join our team?" and inv["can_accept"] is True
    assert (
        "not an application" in inv["acceptance_note"]
        and "reserve a shift" in inv["acceptance_note"]
    )
    detail = (await client.get(f"/v1/candidate/invitations/{inv['id']}", headers=ch)).json()
    assert detail["unread"] is False and detail["terms_changed"] is False

    # pending: no conversation yet, so no messaging
    assert (await client.get("/v1/candidate/conversations", headers=ch)).json() == []

    a = await accept(client, ch, inv["id"])
    assert a.status_code == 200, a.text
    cid = a.json()["conversation_id"]
    assert a.json()["status"] == "accepted" and cid

    m = await client.post(
        f"/v1/employers/{eid}/conversations/{cid}/messages",
        json={"body": "Hi Ana, when could you start?", "client_key": "k1"},
        headers=eh,
    )
    assert m.status_code == 201, m.text
    r2 = await client.post(
        f"/v1/candidate/conversations/{cid}/messages",
        json={"body": "Next Monday <b>works</b>"},
        headers=ch,
    )
    assert r2.status_code == 201
    page = (await client.get(f"/v1/candidate/conversations/{cid}/messages", headers=ch)).json()
    assert [x["mine"] for x in page["items"]] == [False, True]
    assert page["items"][1]["body"] == "Next Monday <b>works</b>"  # plain text, never interpreted
    epage = (
        await client.get(f"/v1/employers/{eid}/conversations/{cid}/messages", headers=eh)
    ).json()
    assert [x["mine"] for x in epage["items"]] == [True, False]
    # acceptance grants nothing else: no contact details, no calendar
    blob = str(epage) + str(
        (await client.get(f"/v1/employers/{eid}/invitations", headers=eh)).json()
    )
    assert "cand-happy@" not in blob and "min_hourly_pay" not in blob
    # the employer's view never carries raw ids of the candidate
    profile_id = (await client.get("/v1/candidate/profile", headers=ch)).json()["id"]
    assert profile_id not in blob
    me = (await client.get("/v1/auth/me", headers=ch)).json()
    assert str(me.get("id", me.get("user_id", "none"))) not in blob


# 2 ---------------------------------------------------------------- authorisation
async def test_unverified_unauthorised_and_cross_tenant_requests_fail_without_leaking(client):
    eh, eid, job, ch, ref = await setup_pair(client, "auth")
    uh, ueid = await register_employer(client, "unv-inv@nua-crew.example.com", "Unverified Cafe")
    assert (await send(client, uh, ueid, body(ref, job))).status_code == 403
    # not a member -> 404, whatever the payload
    assert (await send(client, uh, eid, body(ref, job))).status_code == 404
    # candidate token on an employer route
    assert (await send(client, ch, eid, body(ref, job))).status_code == 404
    assert (
        await client.post(f"/v1/employers/{eid}/invitations", json=body(ref, job))
    ).status_code == 401
    # viewer cannot send
    vh, _ = await register_employer(client, "viewer-inv@nua-crew.example.com", "Viewer Co")
    r = await client.post(
        f"/v1/employers/{eid}/members",
        json={"email": "viewer-inv@nua-crew.example.com", "role": "viewer"},
        headers=eh,
    )
    assert r.status_code == 201, r.text
    assert (await send(client, vh, eid, body(ref, job))).status_code == 403
    # another employer's job
    oh, oeid = await verified_employer(client, "other-inv@nua-crew.example.com", "Other Cafe")
    theirs = await published_job(client, oh, oeid)
    assert (await send(client, eh, eid, body(ref, theirs))).status_code == 404
    # nothing was created by any of the above
    assert (await inbox(client, ch))["items"] == []


# 3/4 -------------------------------------------------------------- re-checked at send
async def test_consent_hidden_blocked_paused_and_inactive_all_refuse_with_one_generic_error(client):
    cases = {}
    for name in ("master", "kind", "hide", "block", "paused"):
        eh, eid, job, ch, ref = await setup_pair(client, f"re-{name}")
        if name == "master":
            await client.put(
                "/v1/candidate/consents/talent-discovery", json={"granted": False}, headers=ch
            )
        elif name == "kind":
            await client.put(
                "/v1/candidate/consents/discovery/temporary", json={"granted": False}, headers=ch
            )
        elif name in ("hide", "block"):
            kind = "hide_from" if name == "hide" else "block"
            await client.post(
                "/v1/candidate/employer-preferences",
                json={"employer_id": eid, "kind": kind},
                headers=ch,
            )
        else:
            await client.put(
                "/v1/candidate/invitation-settings", json={"enabled": False}, headers=ch
            )
        r = await send(client, eh, eid, body(ref, job))
        cases[name] = (r.status_code, r.json()["error"]["code"])
        assert (await inbox(client, ch))["items"] == [], name
    assert set(cases.values()) == {(409, "candidate_unavailable")}, cases

    # a deactivated account is also just "unavailable"
    eh, eid, job, ch, ref = await setup_pair(client, "re-inactive")
    async with db_as("system") as s:
        await s.execute(
            text(
                "UPDATE users SET is_active=false WHERE email='cand-re-inactive@nua-crew.example.com'"
            )
        )
        await s.commit()
    assert (await send(client, eh, eid, body(ref, job))).json()["error"][
        "code"
    ] == "candidate_unavailable"


# 5 ---------------------------------------------------------------- opaque references
async def test_references_are_employer_scoped_expire_and_cannot_be_guessed(client, monkeypatch):
    eh, eid, job, ch, ref = await setup_pair(client, "ref")
    oh, oeid = await verified_employer(client, "ref-other@nua-crew.example.com", "Ref Other")
    ojob = await published_job(client, oh, oeid)
    # another employer cannot use my reference (it never saw this person)
    r = await send(client, oh, oeid, body(ref, ojob))
    assert r.status_code == 404 and r.json()["error"]["code"] == "result_unavailable"
    # nor a guess, nor a raw profile id
    profile_id = (await client.get("/v1/candidate/profile", headers=ch)).json()["id"]
    for bad in ("a" * 24, profile_id.replace("-", "")[:24], profile_id):
        assert (await send(client, eh, eid, body(bad, job))).status_code in (404, 422)
    # an old search result is not permanent authorisation
    monkeypatch.setattr(get_settings(), "talent_ref_ttl_days", 0)
    r = await send(client, eh, eid, body(ref, job))
    assert r.status_code == 404 and r.json()["error"]["code"] == "result_unavailable"


# 6 ---------------------------------------------------------------- duplicates and concurrency
async def test_retries_duplicate_taps_and_concurrent_sends_create_one_pending_invitation(client):
    eh, eid, job, ch, ref = await setup_pair(client, "dup")
    first = await send(client, eh, eid, body(ref, job), key="k-1")
    assert first.status_code == 201
    again = await send(client, eh, eid, body(ref, job), key="k-1")
    assert again.status_code == 200 and again.json()["id"] == first.json()["id"]
    changed = await send(client, eh, eid, body(ref, job, note="different"), key="k-1")
    assert changed.status_code == 409 and changed.json()["error"]["code"] == "idempotency_conflict"
    # another teammate, no key: still the same live invitation
    other = await send(client, eh, eid, body(ref, job))
    assert other.status_code == 409 and other.json()["error"]["code"] == "already_invited"
    assert len((await inbox(client, ch))["items"]) == 1

    # concurrent: same key
    eh2, eid2, job2, ch2, ref2 = await setup_pair(client, "dup2")
    rs = await asyncio.gather(
        *[send(client, eh2, eid2, body(ref2, job2), key="same") for _ in range(6)]
    )
    assert sorted(r.status_code for r in rs).count(201) == 1
    assert {r.json().get("id") for r in rs if r.status_code in (200, 201)} != set()
    assert len((await inbox(client, ch2))["items"]) == 1
    # concurrent: different keys, same target
    eh3, eid3, job3, ch3, ref3 = await setup_pair(client, "dup3")
    rs = await asyncio.gather(
        *[send(client, eh3, eid3, body(ref3, job3), key=f"d-{i}") for i in range(6)]
    )
    assert [r.status_code for r in rs].count(201) == 1
    assert len((await inbox(client, ch3))["items"]) == 1


# 7/8 -------------------------------------------------------------- lifecycle races
async def test_accept_and_withdraw_race_ends_in_exactly_one_terminal_state(client):
    for n in range(3):
        eh, eid, job, ch, ref = await setup_pair(client, f"race{n}")
        inv = (await send(client, eh, eid, body(ref, job))).json()
        th = (await client.get(f"/v1/candidate/invitations/{inv['id']}", headers=ch)).json()[
            "current_terms_hash"
        ]
        a, w = await asyncio.gather(
            accept(client, ch, inv["id"], th),
            client.post(f"/v1/employers/{eid}/invitations/{inv['id']}/withdraw", headers=eh),
        )
        final = (
            await client.get(f"/v1/employers/{eid}/invitations/{inv['id']}", headers=eh)
        ).json()
        assert final["status"] in ("accepted", "withdrawn")
        assert sorted([a.status_code == 200, w.status_code == 200]) == [False, True], (
            a.text,
            w.text,
        )
        convs = (await client.get("/v1/candidate/conversations", headers=ch)).json()
        assert len(convs) == (1 if final["status"] == "accepted" else 0)


async def test_expiry_is_enforced_on_read_and_action_even_if_the_worker_is_late(client):
    eh, eid, job, ch, ref = await setup_pair(client, "exp")
    inv = (await send(client, eh, eid, body(ref, job))).json()
    await backdate(inv["id"], expires_at=datetime.now(UTC) - timedelta(minutes=1))
    # list shows it as expired without anyone persisting it
    assert (await inbox(client, ch))["items"][0]["status"] == "expired"
    assert (await inbox(client, ch))["unread"] == 0
    r = await accept(client, ch, inv["id"], "x" * 16)
    assert r.status_code == 409 and r.json()["error"]["code"] == "invitation_expired"
    async with db_as("system") as s:
        assert (await s.execute(text("select status from invitations"))).scalar_one() == "expired"
    # employer sees expired, cannot withdraw it, and cannot message
    assert (await client.get(f"/v1/employers/{eid}/invitations", headers=eh)).json()[0][
        "status"
    ] == "expired"
    w = await client.post(f"/v1/employers/{eid}/invitations/{inv['id']}/withdraw", headers=eh)
    assert w.status_code == 409


async def test_worker_sweep_expires_late_invitations_once_and_audits(client):
    from app.db import get_sessionmaker
    from app.rls import set_context
    from app.services.invitations import sweep_expired

    eh, eid, job, ch, ref = await setup_pair(client, "sweep")
    inv = (await send(client, eh, eid, body(ref, job))).json()
    await backdate(inv["id"], expires_at=datetime.now(UTC) - timedelta(hours=1))
    async with get_sessionmaker()() as s:
        await set_context(s, role="system")
        assert await sweep_expired(s) == 1
        await s.commit()
    async with get_sessionmaker()() as s:
        await set_context(s, role="system")
        assert await sweep_expired(s) == 0  # running it again changes nothing
        n = (
            await s.execute(
                text("select count(*) from audit_events where action='invitation.expired'")
            )
        ).scalar_one()
        assert n == 1


async def test_repeat_accept_returns_the_same_conversation(client):
    eh, eid, job, ch, ref = await setup_pair(client, "twice")
    inv = (await send(client, eh, eid, body(ref, job))).json()
    th = (await client.get(f"/v1/candidate/invitations/{inv['id']}", headers=ch)).json()[
        "current_terms_hash"
    ]
    rs = await asyncio.gather(*[accept(client, ch, inv["id"], th) for _ in range(4)])
    assert all(r.status_code == 200 for r in rs), [r.text for r in rs]
    assert len({r.json()["conversation_id"] for r in rs}) == 1
    async with db_as("system") as s:
        assert (await s.execute(text("select count(*) from conversations"))).scalar_one() == 1


async def test_decline_needs_no_reason_blocks_messaging_and_starts_an_employer_wide_cooldown(
    client,
):
    eh, eid, job, ch, ref = await setup_pair(client, "decl")
    inv = (await send(client, eh, eid, body(ref, job))).json()
    d = await client.post(f"/v1/candidate/invitations/{inv['id']}/decline", headers=ch)
    assert d.status_code == 200 and d.json()["status"] == "declined"
    assert (
        await client.post(f"/v1/candidate/invitations/{inv['id']}/decline", headers=ch)
    ).status_code == 200
    assert (await accept(client, ch, inv["id"], "y" * 16)).status_code == 409
    assert (await client.get("/v1/candidate/conversations", headers=ch)).json() == []
    # a different teammate, a different job: still blocked by the employer-wide cooldown
    mate, _ = await register_employer(client, "mate-decl@nua-crew.example.com", "Mate Decl")
    r = await client.post(
        f"/v1/employers/{eid}/members",
        json={"email": "mate-decl@nua-crew.example.com", "role": "recruiter"},
        headers=eh,
    )
    assert r.status_code == 201, r.text
    job2 = await published_job(client, eh, eid, title="Other role")
    res = await send(client, mate, eid, body(ref, job2))
    assert res.status_code == 409 and res.json()["error"]["code"] == "cooldown"


# 10 --------------------------------------------------------------- jobs closing / changing
async def test_closed_job_and_material_changes_are_handled_truthfully(client):
    eh, eid, job, ch, ref = await setup_pair(client, "chg")
    inv = (await send(client, eh, eid, body(ref, job))).json()
    first = (await client.get(f"/v1/candidate/invitations/{inv['id']}", headers=ch)).json()
    old_hash = first["current_terms_hash"]
    # the employer raises the pay after the invitation went out
    locs = (await client.get(f"/v1/employers/{eid}/locations", headers=eh)).json()
    edit = await client.put(
        f"/v1/employers/{eid}/jobs/{job['id']}",
        json={"title": "Barista", "description": "Make coffee for a friendly neighbourhood cafe.",
              "employment_type": "casual", "location_id": locs[0]["id"], "pay_min": "30.00",
              "pay_max": "36.00", "pay_period": "hour", "skills": ["Barista"]},
        headers=eh,
    )  # fmt: skip
    assert edit.status_code == 200, edit.text
    now = (await client.get(f"/v1/candidate/invitations/{inv['id']}", headers=ch)).json()
    assert now["terms_changed"] is True
    assert now["terms"]["pay_max"] == "32.00" and now["current_terms"]["pay_max"] == "36.00"
    stale = await accept(client, ch, inv["id"], old_hash)
    assert stale.status_code == 409 and stale.json()["error"]["code"] == "terms_changed"
    ok = await accept(client, ch, inv["id"], now["current_terms_hash"])
    assert ok.status_code == 200
    async with db_as("system") as s:
        row = (
            await s.execute(
                text("select snapshot->>'pay_max', accepted_snapshot->>'pay_max' from invitations")
            )
        ).one()
    assert row == ("32.00", "36.00")  # original snapshot kept; what was accepted is recorded

    # closed job: cannot be accepted, and cannot receive a new invitation
    eh2, eid2, job2, ch2, ref2 = await setup_pair(client, "closed")
    inv2 = (await send(client, eh2, eid2, body(ref2, job2))).json()
    assert (
        await client.post(f"/v1/employers/{eid2}/jobs/{job2['id']}/close", headers=eh2)
    ).status_code == 200
    d = (await client.get(f"/v1/candidate/invitations/{inv2['id']}", headers=ch2)).json()
    assert d["job_open"] is False and d["can_accept"] is False
    r = await accept(client, ch2, inv2["id"], d["current_terms_hash"])
    assert r.status_code == 409 and r.json()["error"]["code"] == "job_closed"
    eh3, eid3, job3, ch3, ref3 = await setup_pair(client, "closed2")
    await client.post(f"/v1/employers/{eid3}/jobs/{job3['id']}/close", headers=eh3)
    assert (await send(client, eh3, eid3, body(ref3, job3))).json()["error"][
        "code"
    ] == "job_not_open"


# 11/12 ------------------------------------------------------------ access removal and blocking
async def test_removed_member_loses_thread_access_immediately_and_block_stops_everything(client):
    eh, eid, job, ch, ref = await setup_pair(client, "blk")
    inv = (await send(client, eh, eid, body(ref, job))).json()
    cid = (await accept(client, ch, inv["id"])).json()["conversation_id"]
    base = f"/v1/employers/{eid}/conversations/{cid}"
    assert (await client.get(f"{base}/messages", headers=eh)).status_code == 200

    # teammate added then removed from the organisation
    th, _ = await register_employer(client, "mate-blk@nua-crew.example.com", "Mate Co")
    assert (
        await client.post(
            f"/v1/employers/{eid}/members",
            json={"email": "mate-blk@nua-crew.example.com", "role": "recruiter"},
            headers=eh,
        )
    ).status_code == 201
    assert (await client.get(f"{base}/messages", headers=th)).status_code == 200
    async with db_as("system") as s:
        await s.execute(
            text(
                "DELETE FROM employer_memberships WHERE user_id = (SELECT id FROM users WHERE email='mate-blk@nua-crew.example.com')"
            )
        )
        await s.commit()
    assert (await client.get(f"{base}/messages", headers=th)).status_code == 404
    assert (
        await client.post(f"{base}/messages", json={"body": "hi"}, headers=th)
    ).status_code == 404

    # candidate blocks the employer
    async with db_as("system") as s:
        before = (await s.execute(text("select count(*) from notifications"))).scalar_one()
    r = await client.post(
        "/v1/candidate/employer-preferences", json={"employer_id": eid, "kind": "block"}, headers=ch
    )
    assert r.status_code == 201
    send_after = await client.post(f"{base}/messages", json={"body": "are you there?"}, headers=eh)
    assert send_after.status_code == 404  # the employer lost the thread
    assert (await client.get(f"{base}/messages", headers=eh)).status_code == 404
    assert (await client.get(f"/v1/employers/{eid}/conversations", headers=eh)).json() == []
    mine = await client.post(
        f"/v1/candidate/conversations/{cid}/messages", json={"body": "bye"}, headers=ch
    )
    assert mine.status_code == 409 and mine.json()["error"]["code"] == "conversation_closed"
    # history is kept for the candidate
    assert (
        len(
            (await client.get(f"/v1/candidate/conversations/{cid}/messages", headers=ch)).json()[
                "items"
            ]
        )
        == 0
    )
    async with db_as("system") as s:
        after = (await s.execute(text("select count(*) from notifications"))).scalar_one()
    assert after == before  # blocking adds no notification, and none came from the refused send
    # and the employer cannot invite again
    job2 = await published_job(client, eh, eid, title="Again")
    found = (await search(client, eh, eid)).json()["items"]
    assert found == []  # blocked people are not even found
    assert (await send(client, eh, eid, body(ref, job2))).json()["error"][
        "code"
    ] == "candidate_unavailable"


async def test_candidate_can_end_a_conversation_and_report_a_message(client):
    eh, eid, job, ch, ref = await setup_pair(client, "rep")
    inv = (await send(client, eh, eid, body(ref, job))).json()
    cid = (await accept(client, ch, inv["id"])).json()["conversation_id"]
    m = (
        await client.post(
            f"/v1/employers/{eid}/conversations/{cid}/messages",
            json={"body": "Send me your bank details"},
            headers=eh,
        )
    ).json()
    r = await client.post(
        f"/v1/candidate/conversations/{cid}/report",
        json={"reason": "Asked for bank details", "message_id": m["id"]},
        headers=ch,
    )
    assert r.status_code == 201
    async with db_as("system") as s:
        row = (await s.execute(text("select reason, excerpt, status from message_reports"))).one()
    assert row == ("Asked for bank details", "Send me your bank details", "open")
    # reports are support-only data: an employer session reads nothing
    async with db_as("employer", employer_ids=[uuid.UUID(eid)]) as s:
        assert (await s.execute(text("select count(*) from message_reports"))).scalar_one() == 0
    c = await client.post(f"/v1/candidate/conversations/{cid}/close", headers=ch)
    assert c.json()["status"] == "closed"
    refused = await client.post(
        f"/v1/employers/{eid}/conversations/{cid}/messages", json={"body": "hello?"}, headers=eh
    )
    assert refused.status_code == 409


async def test_message_limits_idempotency_and_cursor_paging(client):
    eh, eid, job, ch, ref = await setup_pair(client, "msg")
    inv = (await send(client, eh, eid, body(ref, job))).json()
    cid = (await accept(client, ch, inv["id"])).json()["conversation_id"]
    url = f"/v1/employers/{eid}/conversations/{cid}/messages"
    assert (await client.post(url, json={"body": "x" * 2001}, headers=eh)).status_code == 422
    assert (await client.post(url, json={"body": "   "}, headers=eh)).status_code == 422
    a = await client.post(url, json={"body": "one", "client_key": "m1"}, headers=eh)
    b = await client.post(url, json={"body": "one", "client_key": "m1"}, headers=eh)
    assert (a.status_code, b.status_code) == (201, 200) and a.json()["id"] == b.json()["id"]
    c = await client.post(url, json={"body": "other", "client_key": "m1"}, headers=eh)
    assert c.status_code == 409
    for i in range(2, 6):
        await client.post(url, json={"body": f"m{i}"}, headers=eh)
    page1 = (
        await client.get(
            f"/v1/candidate/conversations/{cid}/messages", params={"limit": 3}, headers=ch
        )
    ).json()
    assert [m["body"] for m in page1["items"]] == ["m3", "m4", "m5"] and page1["next_before"]
    page2 = (
        await client.get(
            f"/v1/candidate/conversations/{cid}/messages",
            params={"limit": 3, "before": page1["next_before"]},
            headers=ch,
        )
    ).json()
    assert [m["body"] for m in page2["items"]] == ["one", "m2"] and page2["next_before"] is None


# 13 --------------------------------------------------------------- quotas
async def test_employer_quota_is_shared_by_teammates_and_holds_under_concurrency(
    client, monkeypatch
):
    monkeypatch.setattr(get_settings(), "invitation_employer_daily_limit", 2)
    eh, eid = await verified_employer(client, "quota@nua-crew.example.com", "Quota Cafe")
    job = await published_job(client, eh, eid)
    th, _ = await register_employer(client, "quota-mate@nua-crew.example.com", "Quota Mate")
    await client.post(
        f"/v1/employers/{eid}/members",
        json={"email": "quota-mate@nua-crew.example.com", "role": "recruiter"},
        headers=eh,
    )
    refs = []
    for i in range(4):
        await discoverable_candidate(client, f"q{i}@nua-crew.example.com", f"Quinn Q{i}")
    items = (await search(client, eh, eid)).json()["items"]
    refs = [i["ref"] for i in items]
    assert len(refs) == 4
    # both teammates send concurrently; together they cannot exceed 2
    results = await asyncio.gather(
        send(client, eh, eid, body(refs[0], job)),
        send(client, th, eid, body(refs[1], job)),
        send(client, eh, eid, body(refs[2], job)),
        send(client, th, eid, body(refs[3], job)),
    )
    codes = sorted(r.status_code for r in results)
    assert codes.count(201) == 2 and codes.count(429) == 2, [r.text for r in results]
    async with db_as("system") as s:
        assert (await s.execute(text("select count(*) from invitations"))).scalar_one() == 2


async def test_per_job_and_per_recipient_limits(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "invitation_job_daily_limit", 1)
    eh, eid = await verified_employer(client, "jobq@nua-crew.example.com", "JobQ Cafe")
    job = await published_job(client, eh, eid)
    for i in range(2):
        await discoverable_candidate(client, f"jq{i}@nua-crew.example.com", f"Jo Q{i}")
    refs = [i["ref"] for i in (await search(client, eh, eid)).json()["items"]]
    assert (await send(client, eh, eid, body(refs[0], job))).status_code == 201
    r = await send(client, eh, eid, body(refs[1], job))
    assert r.status_code == 429 and r.json()["error"]["code"] == "invitation_quota"

    monkeypatch.setattr(get_settings(), "invitation_job_daily_limit", 15)
    monkeypatch.setattr(get_settings(), "invitation_candidate_daily_limit", 1)
    other_h, other_id = await verified_employer(client, "recip@nua-crew.example.com", "Recip Cafe")
    ojob = await published_job(client, other_h, other_id)
    ref_other = (await search(client, other_h, other_id)).json()["items"]
    assert ref_other
    # the first candidate already received one invitation today: a second employer is refused generically
    r = await send(client, other_h, other_id, body(ref_other[0]["ref"], ojob))
    assert r.status_code == 409 and r.json()["error"]["code"] in (
        "candidate_unavailable",
        "result_unavailable",
    )


async def test_discovery_budget_limits_distinct_candidates_shown_per_day(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "talent_daily_candidate_budget", 2)
    eh, eid = await verified_employer(client, "budget@nua-crew.example.com", "Budget Cafe")
    for i in range(3):
        await discoverable_candidate(client, f"b{i}@nua-crew.example.com", f"Bea B{i}")
    first = (await search(client, eh, eid)).json()["items"]
    assert len(first) == 2  # trimmed to the budget
    again = (await search(client, eh, eid)).json()["items"]
    assert {i["ref"] for i in again} == {
        i["ref"] for i in first
    }  # already-seen people stay visible
    monkeypatch.setattr(get_settings(), "talent_daily_candidate_budget", 0)
    r = await search(client, eh, eid, skills=["Nonexistent"])
    assert r.status_code == 200 and r.json()["items"] == []
    other_h, other_id = await verified_employer(
        client, "budget2@nua-crew.example.com", "Budget2 Cafe"
    )
    denied = await search(client, other_h, other_id)
    assert denied.status_code == 429 and denied.json()["error"]["code"] == "discovery_budget"


# 14 --------------------------------------------------------------- outbox / push
class Recorder:
    def __init__(self, fail=False):
        self.sent, self.fail = [], fail

    async def send(self, messages):
        self.sent += messages
        return [push.PushResult(m.token, ok=not self.fail) for m in messages]


async def test_notifications_are_generic_durable_and_pushed_once(client):
    from app.db import get_sessionmaker
    from app.rls import set_context

    eh, eid, job, ch, ref = await setup_pair(client, "push")
    await client.post(
        "/v1/devices", json={"token": "ExponentPushToken[abc]", "platform": "ios"}, headers=ch
    )
    inv = (await send(client, eh, eid, body(ref, job, note="Secret pay talk"))).json()
    notes = (await client.get("/v1/notifications", headers=ch)).json()
    n = [x for x in notes if x["kind"] == "invitation_received"]
    assert len(n) == 1 and n[0]["title"] == "You have a new invitation"
    assert "Cafe push" not in str(n) and "Secret" not in str(
        n
    )  # details need an authenticated fetch

    rec = Recorder(fail=True)  # provider outage: the invitation must survive, nothing duplicates
    for _ in range(2):
        async with get_sessionmaker()() as s:
            await set_context(s, role="system")
            await push.deliver_pending(s, sender=rec)
            await s.commit()
    assert len(rec.sent) == 1  # processed once, even though the provider said no
    assert rec.sent[0].data["invitation_id"] == inv["id"] and "Cafe" not in str(rec.sent[0])
    assert (await inbox(client, ch))["items"][0]["status"] == "pending"


async def test_new_message_nudges_once_until_read_and_not_when_push_is_off(client):
    eh, eid, job, ch, ref = await setup_pair(client, "nudge")
    inv = (await send(client, eh, eid, body(ref, job))).json()
    cid = (await accept(client, ch, inv["id"])).json()["conversation_id"]
    url = f"/v1/employers/{eid}/conversations/{cid}/messages"
    for t in ("a", "b", "c"):
        await client.post(url, json={"body": t}, headers=eh)
    kinds = [x["kind"] for x in (await client.get("/v1/notifications", headers=ch)).json()]
    assert kinds.count("message_received") == 1
    summary = (await client.get("/v1/candidate/inbox/summary", headers=ch)).json()
    assert summary["unread_conversations"] == 1
    assert (
        await client.post(f"/v1/candidate/conversations/{cid}/read", headers=ch)
    ).status_code == 204
    assert (await client.get("/v1/candidate/inbox/summary", headers=ch)).json()[
        "unread_conversations"
    ] == 0
    await client.post(url, json={"body": "d"}, headers=eh)
    kinds = [x["kind"] for x in (await client.get("/v1/notifications", headers=ch)).json()]
    assert kinds.count("message_received") == 2


# 16/17 ------------------------------------------------------------ privacy, RLS
async def test_rls_isolates_invitations_conversations_and_messages(client):
    eh, eid, job, ch, ref = await setup_pair(client, "rls")
    inv = (await send(client, eh, eid, body(ref, job))).json()
    cid = (await accept(client, ch, inv["id"])).json()["conversation_id"]
    await client.post(
        f"/v1/employers/{eid}/conversations/{cid}/messages", json={"body": "hello"}, headers=eh
    )
    oh, oeid = await verified_employer(client, "rls-o@nua-crew.example.com", "Rls Other")
    other_c = await register_candidate(client, "rls-oc@nua-crew.example.com", "Other Cand")

    tables = ("invitations", "conversations", "messages", "message_reports", "talent_exposures")
    counts = {t: f"select count(*) from {t}" for t in tables}  # noqa: S608
    async with db_as("employer", employer_ids=[uuid.UUID(oeid)]) as s:
        for t, sql in counts.items():
            assert (await s.execute(text(sql))).scalar_one() == 0, t
    async with db_as("employer", employer_ids=[uuid.UUID(eid)]) as s:
        assert (await s.execute(text(counts["invitations"]))).scalar_one() == 1
        assert (await s.execute(text(counts["messages"]))).scalar_one() == 1
        assert (await s.execute(text(counts["talent_exposures"]))).scalar_one() == 0  # support only
    # another candidate sees nothing, through the API and through raw SQL
    assert (await inbox(client, other_c))["items"] == []
    assert (
        await client.get(f"/v1/candidate/invitations/{inv['id']}", headers=other_c)
    ).status_code == 404
    assert (
        await client.get(f"/v1/candidate/conversations/{cid}/messages", headers=other_c)
    ).status_code == 404
    assert (
        await client.post(f"/v1/candidate/invitations/{inv['id']}/decline", headers=other_c)
    ).status_code == 404
    # another employer cannot see, withdraw or read
    assert (
        await client.get(f"/v1/employers/{oeid}/invitations/{inv['id']}", headers=oh)
    ).status_code == 404
    assert (
        await client.get(f"/v1/employers/{oeid}/conversations/{cid}/messages", headers=oh)
    ).status_code == 404
    # an employer cannot write a message into a thread it does not belong to, even via SQL
    async with db_as("employer", employer_ids=[uuid.UUID(oeid)]) as s:
        import sqlalchemy.exc as sx

        try:
            await s.execute(
                text(
                    "insert into messages (conversation_id, sender_role, body) values (:c, 'employer', 'x')"
                ),
                {"c": cid},
            )
            raise AssertionError("insert should have been refused")
        except sx.DBAPIError:
            pass


async def test_export_and_deletion_cover_invitations_and_threads(client):
    eh, eid, job, ch, ref = await setup_pair(client, "exp2")
    inv = (await send(client, eh, eid, body(ref, job))).json()
    cid = (await accept(client, ch, inv["id"])).json()["conversation_id"]
    m = (
        await client.post(
            f"/v1/employers/{eid}/conversations/{cid}/messages",
            json={"body": "welcome aboard"},
            headers=eh,
        )
    ).json()
    await client.post(
        f"/v1/candidate/conversations/{cid}/report",
        json={"reason": "just testing", "message_id": m["id"]},
        headers=ch,
    )
    data = (await client.get("/v1/account/export", headers=ch)).json()
    assert data["invitations"][0]["business"] == "Cafe exp2"
    assert data["conversations"][0]["messages"][0]["body"] == "welcome aboard"
    assert data["message_reports"][0]["reason"] == "just testing"
    blob = str(data)
    assert "emp-exp2@" not in blob and eid not in blob  # nothing about the employer's staff
    r = await client.request(
        "DELETE", "/v1/account", json={"password": "correct-horse-battery"}, headers=ch
    )
    assert r.status_code == 204
    async with db_as("system") as s:
        for t in ("invitations", "conversations", "messages"):
            assert (await s.execute(text(f"select count(*) from {t}"))).scalar_one() == 0, t  # noqa: S608
        # the minimal support record survives, detached from the person
        rep = (await s.execute(text("select reporter_user_id, excerpt from message_reports"))).one()
        assert rep == (None, "welcome aboard")
    # the employer's list simply no longer has the person
    assert (await client.get(f"/v1/employers/{eid}/invitations", headers=eh)).json() == []


async def test_invitation_settings_pause_is_separate_from_pending_and_threads(client):
    eh, eid, job, ch, ref = await setup_pair(client, "pause")
    inv = (await send(client, eh, eid, body(ref, job))).json()
    cid = (await accept(client, ch, inv["id"])).json()["conversation_id"]
    assert (
        await client.put("/v1/candidate/invitation-settings", json={"enabled": False}, headers=ch)
    ).json() == {"invitations_enabled": False}
    # an accepted conversation carries on until it is ended or blocked
    assert (
        await client.post(
            f"/v1/employers/{eid}/conversations/{cid}/messages",
            json={"body": "still here"},
            headers=eh,
        )
    ).status_code == 201
    assert (await client.get("/v1/candidate/invitation-settings", headers=ch)).json()[
        "invitations_enabled"
    ] is False
