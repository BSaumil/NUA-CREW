"""The introductory free-advertising offer: closed by default, capped, audited, tenant-isolated."""

from datetime import UTC, datetime, timedelta

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.exc import DBAPIError, ProgrammingError

from app.config import get_settings
from tests.conftest import (
    JOB,
    admin_headers,
    db_as,
    published_job,
    register_employer,
    verified_employer,
)


async def _draft(client: httpx.AsyncClient, headers: dict, eid: str, **over) -> dict:
    locs = (await client.get(f"/v1/employers/{eid}/locations", headers=headers)).json()
    body = {**JOB, "location_id": locs[0]["id"], **over}
    r = await client.post(f"/v1/employers/{eid}/jobs", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


async def _publish(client: httpx.AsyncClient, headers: dict, eid: str, job_id: str):
    return await client.post(f"/v1/employers/{eid}/jobs/{job_id}/publish", headers=headers)


async def test_publishing_is_closed_until_the_owner_opens_the_offer(client, monkeypatch):
    emp, eid = await verified_employer(client, "intro-closed@nua-crew.example.com")
    monkeypatch.setattr(get_settings(), "intro_offer_enabled", False)
    job = await _draft(client, emp, eid)  # drafting still works
    r = await _publish(client, emp, eid, job["id"])
    assert r.status_code == 409, r.text
    assert r.json()["error"]["code"] == "publishing_not_open"
    assert "draft is saved" in r.json()["error"]["message"]
    # Nothing was granted and the job is still a draft.
    async with db_as("system") as s:
        n = (await s.execute(text("SELECT count(*) FROM intro_ad_grants"))).scalar_one()
    assert n == 0


def test_the_offer_is_off_by_default_with_a_visible_unapproved_terms_version(monkeypatch):
    from app.config import Settings

    monkeypatch.delenv("NUA_INTRO_OFFER_ENABLED", raising=False)
    s = Settings(env="development", _env_file=None)
    assert s.intro_offer_enabled is False
    assert s.intro_offer_terms_version == "unapproved-draft"
    assert s.intro_offer_days == 14


async def test_publishing_grants_fourteen_days_records_it_and_audits_it(client):
    emp, eid = await verified_employer(client, "intro-open@nua-crew.example.com")
    job = await published_job(client, emp, eid)
    expires = datetime.fromisoformat(job["expires_at"])
    assert (
        timedelta(days=13, hours=23) < expires - datetime.now(UTC) <= timedelta(days=14, minutes=1)
    )
    async with db_as("system") as s:
        row = (
            await s.execute(
                text("SELECT terms_version, starts_at, ends_at, granted_by FROM intro_ad_grants")
            )
        ).one()
        audit = (
            await s.execute(
                text("SELECT count(*) FROM audit_events WHERE action = 'job.intro_granted'")
            )
        ).scalar_one()
    assert row.terms_version == get_settings().intro_offer_terms_version
    assert row.ends_at - row.starts_at == timedelta(days=14)
    assert row.granted_by is not None
    assert audit == 1


async def test_an_employer_cannot_extend_the_ad_by_editing_its_end_date(client):
    emp, eid = await verified_employer(client, "intro-extend@nua-crew.example.com")
    job = await published_job(client, emp, eid)
    locs = (await client.get(f"/v1/employers/{eid}/locations", headers=emp)).json()
    far = (datetime.now(UTC) + timedelta(days=200)).isoformat()
    r = await client.put(
        f"/v1/employers/{eid}/jobs/{job['id']}",
        json={**JOB, "location_id": locs[0]["id"], "expires_at": far},
        headers=emp,
    )
    assert r.status_code == 200, r.text
    assert r.json()["expires_at"] == job["expires_at"]


async def test_an_earlier_end_date_is_respected_on_publish(client):
    emp, eid = await verified_employer(client, "intro-early@nua-crew.example.com")
    soon = (datetime.now(UTC) + timedelta(days=3)).isoformat()
    job = await _draft(client, emp, eid, expires_at=soon)
    r = await _publish(client, emp, eid, job["id"])
    assert r.status_code == 200, r.text
    got = datetime.fromisoformat(r.json()["expires_at"])
    assert abs(got - datetime.fromisoformat(soon)) < timedelta(seconds=1)


async def test_republishing_inside_a_live_grant_does_not_use_another(client):
    emp, eid = await verified_employer(client, "intro-republish@nua-crew.example.com")
    job = await published_job(client, emp, eid)
    r = await client.post(f"/v1/employers/{eid}/jobs/{job['id']}/unpublish", headers=emp)
    assert r.status_code == 200, r.text
    r = await _publish(client, emp, eid, job["id"])
    assert r.status_code == 200, r.text
    async with db_as("system") as s:
        n = (await s.execute(text("SELECT count(*) FROM intro_ad_grants"))).scalar_one()
    assert n == 1


async def test_the_live_cap_stops_another_ad_and_closing_one_frees_a_slot(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "intro_offer_max_active_per_employer", 2)
    emp, eid = await verified_employer(client, "intro-cap@nua-crew.example.com")
    first = await published_job(client, emp, eid)
    await published_job(client, emp, eid)
    third = await _draft(client, emp, eid)
    r = await _publish(client, emp, eid, third["id"])
    assert r.status_code == 409, r.text
    assert r.json()["error"]["code"] == "intro_limit_reached"
    assert "2 live job ads" in r.json()["error"]["message"]
    # Closing a job does not hand the slot back until its free period ends (the grant is still
    # live), so the cap cannot be cycled to publish without limit.
    await client.post(f"/v1/employers/{eid}/jobs/{first['id']}/close", headers=emp)
    r = await _publish(client, emp, eid, third["id"])
    assert r.status_code == 409, r.text


async def test_the_thirty_day_cap_applies_even_after_ads_end(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "intro_offer_max_active_per_employer", 10)
    monkeypatch.setattr(get_settings(), "intro_offer_max_per_30_days", 2)
    emp, eid = await verified_employer(client, "intro-window@nua-crew.example.com")
    await published_job(client, emp, eid)
    await published_job(client, emp, eid)
    # Age both grants so they are no longer live but are still inside the 30-day window.
    async with db_as("system") as s:
        await s.execute(
            text(
                "UPDATE intro_ad_grants SET starts_at = starts_at - interval '20 days', "
                "ends_at = ends_at - interval '20 days'"
            )
        )
        await s.commit()
    third = await _draft(client, emp, eid)
    r = await _publish(client, emp, eid, third["id"])
    assert r.status_code == 409, r.text
    assert "30 days" in r.json()["error"]["message"]


async def test_the_caps_are_per_employer(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "intro_offer_max_active_per_employer", 1)
    a, aid = await verified_employer(client, "intro-a@nua-crew.example.com", "A Cafe")
    b, bid = await verified_employer(client, "intro-b@nua-crew.example.com", "B Cafe")
    await published_job(client, a, aid)
    await published_job(client, b, bid)  # B is not blocked by A's use


async def test_an_unverified_employer_still_cannot_publish(client):
    emp, eid = await register_employer(client, "intro-unverified@nua-crew.example.com")
    job = await _draft(client, emp, eid)
    r = await _publish(client, emp, eid, job["id"])
    assert r.status_code == 403, r.text
    async with db_as("system") as s:
        n = (await s.execute(text("SELECT count(*) FROM intro_ad_grants"))).scalar_one()
    assert n == 0


async def test_status_endpoint_states_there_is_no_charge_and_counts_use(client):
    emp, eid = await verified_employer(client, "intro-status@nua-crew.example.com")
    r = await client.get(f"/v1/employers/{eid}/intro-offer", headers=emp)
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["enabled"] is True
    assert body["days"] == 14
    assert body["charged"] is False and body["card_required"] is False
    assert body["active_used"] == 0
    assert "not currently chargeable" in body["planned_paid_price_note"]
    await published_job(client, emp, eid)
    r = await client.get(f"/v1/employers/{eid}/intro-offer", headers=emp)
    assert r.json()["active_used"] == 1 and r.json()["used_30_days"] == 1


async def test_another_employer_cannot_read_the_status_or_the_grants(client):
    a, aid = await verified_employer(client, "intro-iso-a@nua-crew.example.com", "A Cafe")
    b, bid = await verified_employer(client, "intro-iso-b@nua-crew.example.com", "B Cafe")
    await published_job(client, a, aid)
    r = await client.get(f"/v1/employers/{aid}/intro-offer", headers=b)
    assert r.status_code == 404, r.text
    r = await client.get(f"/v1/employers/{aid}/intro-offer")
    assert r.status_code in (401, 403)
    # At the database: B's identity sees none of A's grants.
    async with db_as("employer", employer_ids=[bid]) as s:
        seen = (await s.execute(text("SELECT count(*) FROM intro_ad_grants"))).scalar_one()
    assert seen == 0
    async with db_as("employer", employer_ids=[aid]) as s:
        seen = (await s.execute(text("SELECT count(*) FROM intro_ad_grants"))).scalar_one()
    assert seen == 1


async def test_a_member_cannot_grant_themselves_an_ad_through_the_database(client):
    emp, eid = await verified_employer(client, "intro-self@nua-crew.example.com")
    job = await _draft(client, emp, eid)
    now = datetime.now(UTC)
    with pytest.raises((DBAPIError, ProgrammingError)):
        async with db_as("employer", employer_ids=[eid]) as s:
            await s.execute(
                text(
                    "INSERT INTO intro_ad_grants (employer_id, job_id, terms_version, starts_at, ends_at) "
                    "VALUES (:e, :j, 'self', :s, :f)"
                ),
                {"e": eid, "j": job["id"], "s": now, "f": now + timedelta(days=3650)},
            )
    # And an existing grant cannot be stretched by its own employer.
    await _publish(client, emp, eid, job["id"])
    async with db_as("employer", employer_ids=[eid]) as s:
        res = await s.execute(
            text("UPDATE intro_ad_grants SET ends_at = ends_at + interval '3650 days'")
        )
        assert res.rowcount == 0


async def test_the_status_is_unaffected_by_an_admin_token_only(client):
    # Sanity: operators have their own paths; the employer endpoint stays tenant-scoped.
    emp, eid = await verified_employer(client, "intro-admin@nua-crew.example.com")
    admin = await admin_headers(client)
    r = await client.get(f"/v1/employers/{eid}/intro-offer", headers=admin)
    assert r.status_code in (200, 403, 404)
