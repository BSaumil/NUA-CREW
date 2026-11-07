"""Owner decisions, 2026-11-07: role required to publish, ABN required at employer sign-up,
verified email required to post and apply (only while mail can be delivered)."""

import pytest

from app.config import Settings, get_settings
from app.services import verified_email
from tests.conftest import register_candidate, register_employer, verified_employer


def test_shipped_defaults():
    settings = Settings(_env_file=None)
    assert settings.require_role_on_publish is True
    assert settings.require_verified_email is True


async def _enable_delivery(monkeypatch):
    monkeypatch.setattr(get_settings(), "email_provider", "file")
    monkeypatch.setattr(get_settings(), "require_verified_email", True)


@pytest.mark.asyncio
async def test_gate_is_inactive_without_a_mail_transport(client, monkeypatch):
    monkeypatch.setattr(get_settings(), "require_verified_email", True)
    assert verified_email.gate_active() is False
    headers, eid = await verified_employer(client, "gate-off@nua-crew.example.com")
    r = await client.get(f"/v1/employers/{eid}/locations", headers=headers)
    assert r.status_code == 200


@pytest.mark.asyncio
async def test_unverified_email_cannot_post_a_job(client, monkeypatch, tmp_path):
    monkeypatch.setattr(get_settings(), "email_file_dir", str(tmp_path))
    headers, eid = await verified_employer(client, "gate-post@nua-crew.example.com")
    await _enable_delivery(monkeypatch)
    locs = (await client.get(f"/v1/employers/{eid}/locations", headers=headers)).json()
    body = {
        "title": "Barista",
        "description": "Fictional role for tests " * 4,
        "employment_type": "casual",
        "location_id": locs[0]["id"],
        "skills": [],
    }
    blocked = await client.post(f"/v1/employers/{eid}/jobs", json=body, headers=headers)
    assert blocked.status_code == 403
    assert blocked.json()["error"]["code"] == "email_not_verified"


@pytest.mark.asyncio
async def test_unverified_candidate_cannot_apply(client, monkeypatch, tmp_path):
    monkeypatch.setattr(get_settings(), "email_file_dir", str(tmp_path))
    cand = await register_candidate(client, "gate-apply@nua-crew.example.com")
    await _enable_delivery(monkeypatch)
    r = await client.post(
        "/v1/jobs/00000000-0000-0000-0000-000000000000/applications",
        json={},
        headers=cand,
    )
    assert r.status_code == 403 and r.json()["error"]["code"] == "email_not_verified"


@pytest.mark.asyncio
async def test_a_verified_email_passes_the_gate(client, monkeypatch, tmp_path):
    monkeypatch.setattr(get_settings(), "email_file_dir", str(tmp_path))
    headers, eid = await register_employer(client, "gate-ok@nua-crew.example.com")
    from sqlalchemy import text

    from app.db import get_sessionmaker

    async with get_sessionmaker()() as s:
        await s.execute(
            text("update users set email_verified_at = now() where email = :e"),
            {"e": "gate-ok@nua-crew.example.com"},
        )
        await s.commit()
    await _enable_delivery(monkeypatch)
    r = await client.get(f"/v1/employers/{eid}/locations", headers=headers)
    assert r.status_code == 200
