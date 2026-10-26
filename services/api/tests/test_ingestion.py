import json
from copy import deepcopy

import pytest

from app.config import get_settings
from tests.conftest import admin_headers, register_candidate

pytestmark = pytest.mark.asyncio

BASE_RECORDS = json.loads(open("fixtures/licensed_feed.json").read())["records"]
FIELDS = [
    "title", "description", "apply_url", "employment_type", "company", "category",
    "suburb", "state", "postcode", "pay_min", "pay_max", "pay_period", "skills",
]  # fmt: skip


@pytest.fixture
def feed(tmp_path, monkeypatch):
    monkeypatch.setattr(get_settings(), "fixtures_dir", str(tmp_path))

    def write(records):
        (tmp_path / "feed.json").write_text(json.dumps({"records": records}))

    write(deepcopy(BASE_RECORDS))
    return write


async def _source(client, admin, grant=True, fields=None, **perm):
    r = await client.post(
        "/v1/admin/ingestion/sources",
        json={
            "slug": "test-feed",
            "name": "Test feed",
            "kind": "fixture",
            "config": {"file": "feed.json"},
        },
        headers=admin,
    )
    assert r.status_code == 201, r.text
    sid = r.json()["id"]
    if grant:
        r = await client.post(
            f"/v1/admin/ingestion/sources/{sid}/permissions",
            json={
                "legal_basis": "Fixture agreement",
                "license": "Test-only licence",
                "attribution": "Example Licensed Feed",
                "permitted_fields": fields or FIELDS,
                **perm,
            },
            headers=admin,
        )
        assert r.status_code == 201, r.text
    return sid


async def _run(client, admin, sid):
    return await client.post(f"/v1/admin/ingestion/sources/{sid}/run", headers=admin)


async def test_source_without_permission_is_rejected_and_nothing_indexed(client, feed):
    admin = await admin_headers(client)
    sid = await _source(client, admin, grant=False)
    r = await _run(client, admin, sid)
    assert r.status_code == 403 and r.json()["error"] == "no_active_permission"
    assert (await client.get("/v1/jobs")).json()["total"] == 0


async def test_expired_permission_is_rejected(client, feed):
    admin = await admin_headers(client)
    sid = await _source(client, admin, valid_until="2000-01-01T00:00:00Z")
    assert (await _run(client, admin, sid)).status_code == 403
    assert (await client.get("/v1/jobs")).json()["total"] == 0


async def test_non_admin_cannot_manage_sources(client, feed):
    cand = await register_candidate(client, "c@x.example.com")
    r = await client.post(
        "/v1/admin/ingestion/sources",
        json={"slug": "nope-feed", "name": "x", "kind": "fixture"},
        headers=cand,
    )
    assert r.status_code == 403


async def test_approved_run_is_repeat_safe(client, feed):
    admin = await admin_headers(client)
    sid = await _source(client, admin)
    first = (await _run(client, admin, sid)).json()
    assert first["stats"]["created"] == 2
    second = (await _run(client, admin, sid)).json()
    assert second["stats"]["created"] == 0 and second["stats"]["unchanged"] == 2
    jobs = (await client.get("/v1/jobs")).json()
    assert jobs["total"] == 2
    barista = next(j for j in jobs["items"] if j["title"] == "Barista")
    assert barista["origin"] == "ingested" and barista["pay_basis"] == "disclosed"
    assert barista["attribution"] == "Example Licensed Feed"
    assert barista["apply_url"].startswith("https://")
    assert "<p>" not in barista["description"]


async def test_injected_listing_stays_unverified_text(client, feed):
    admin = await admin_headers(client)
    sid = await _source(client, admin)
    await _run(client, admin, sid)
    kitchen = next(
        j for j in (await client.get("/v1/jobs")).json()["items"] if j["title"] == "Kitchen Hand"
    )
    assert "Ignore all previous instructions" in kitchen["description"]
    assert kitchen["employer"]["verification_status"] is None  # never marked verified
    assert kitchen["pay_basis"] == "not_disclosed"


async def test_changed_listing_updates_and_versions(client, feed):
    admin = await admin_headers(client)
    sid = await _source(client, admin)
    await _run(client, admin, sid)
    changed = deepcopy(BASE_RECORDS)
    changed[0]["title"] = "Senior Barista"
    feed(changed)
    r = (await _run(client, admin, sid)).json()
    assert r["stats"]["updated"] == 1 and r["stats"]["unchanged"] == 1
    titles = {j["title"] for j in (await client.get("/v1/jobs")).json()["items"]}
    assert titles == {"Senior Barista", "Kitchen Hand"}
    from sqlalchemy import text

    from tests.conftest import db_as

    async with db_as() as s:
        n = (await s.execute(text("select count(*) from job_versions"))).scalar()
    assert n == 3  # 2 created + 1 update


async def test_removed_listing_expires_and_returns(client, feed):
    admin = await admin_headers(client)
    sid = await _source(client, admin)
    await _run(client, admin, sid)
    feed(deepcopy(BASE_RECORDS[:1]))
    r = (await _run(client, admin, sid)).json()
    assert r["stats"]["expired"] == 1
    assert [j["title"] for j in (await client.get("/v1/jobs")).json()["items"]] == ["Barista"]
    feed(deepcopy(BASE_RECORDS))
    await _run(client, admin, sid)
    assert (await client.get("/v1/jobs")).json()["total"] == 2


async def test_invalid_records_are_skipped_not_published(client, feed):
    admin = await admin_headers(client)
    bad = deepcopy(BASE_RECORDS)
    bad[1]["apply_url"] = "http://insecure.example.com/x"
    bad.append({"external_id": "fx-bad", "title": ""})
    feed(bad)
    sid = await _source(client, admin)
    r = (await _run(client, admin, sid)).json()
    assert r["stats"]["created"] == 1 and r["stats"]["invalid"] == 2
    assert (await client.get("/v1/jobs")).json()["total"] == 1


async def test_permitted_fields_are_enforced(client, feed):
    admin = await admin_headers(client)
    no_pay = [f for f in FIELDS if not f.startswith("pay_")]
    sid = await _source(client, admin, fields=no_pay)
    await _run(client, admin, sid)
    barista = next(
        j for j in (await client.get("/v1/jobs")).json()["items"] if j["title"] == "Barista"
    )
    assert barista["pay_min"] is None and barista["pay_basis"] == "not_disclosed"


async def test_grant_missing_required_fields_is_rejected(client, feed):
    admin = await admin_headers(client)
    sid = await _source(client, admin, fields=["title"])
    r = await _run(client, admin, sid)
    assert r.status_code == 403 and r.json()["error"] == "permission_missing_required_fields"
    assert (await client.get("/v1/jobs")).json()["total"] == 0


async def test_revocation_takes_down_and_stops_collector(client, feed):
    admin = await admin_headers(client)
    sid = await _source(client, admin)
    await _run(client, admin, sid)
    r = await client.post(f"/v1/admin/ingestion/sources/{sid}/takedown", headers=admin)
    assert r.json() == {"unpublished": 2}
    assert (await client.get("/v1/jobs")).json()["total"] == 0
    assert (await _run(client, admin, sid)).status_code == 403
    assert (await client.get("/v1/jobs")).json()["total"] == 0
    r = await client.post(
        f"/v1/admin/ingestion/sources/{sid}/permissions",
        json={"legal_basis": "x", "license": "y", "permitted_fields": FIELDS},
        headers=admin,
    )
    assert r.status_code == 409


async def test_ingested_jobs_redirect_to_external_application(client, feed):
    admin = await admin_headers(client)
    sid = await _source(client, admin)
    await _run(client, admin, sid)
    job = (await client.get("/v1/jobs")).json()["items"][0]
    cand = await register_candidate(client, "c@x.example.com")
    r = await client.post(f"/v1/jobs/{job['id']}/applications", json={}, headers=cand)
    assert r.status_code == 409 and r.json()["error"]["code"] == "external_application"


async def test_fixture_path_cannot_escape(client, feed):
    from app.services.ingestion.connector import FixtureConnector

    with pytest.raises(ValueError):
        FixtureConnector("../pyproject.toml")
