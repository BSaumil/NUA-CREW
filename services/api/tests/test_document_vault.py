"""Real Postgres/RLS acceptance; scanner transport is an explicit local test double."""

import io
import uuid
from unittest.mock import AsyncMock

import pytest
from pypdf import PdfWriter
from sqlalchemy import text

from app.config import get_settings
from app.services import documents
from tests.conftest import db_as, register_candidate, verified_employer


@pytest.fixture
def vault(monkeypatch, tmp_path):
    settings = get_settings()
    monkeypatch.setattr(settings, "document_storage", "local")
    monkeypatch.setattr(settings, "document_local_root", str(tmp_path))
    monkeypatch.setattr(settings, "document_clamd_host", "scanner.fixture")
    monkeypatch.setattr(documents, "scan", AsyncMock())


def file_bytes():
    writer = PdfWriter()
    writer.add_blank_page(100, 100)
    out = io.BytesIO()
    writer.write(out)
    return out.getvalue()


async def reserve(client, headers, data):
    body = {
        "kind": "resume",
        "title": "Private resume",
        "filename": "resume.pdf",
        "content_type": "application/pdf",
        "size_bytes": len(data),
        "client_key": "stable-document-key",
    }
    result = await client.post("/v1/candidate/documents", headers=headers, json=body)
    assert result.status_code == 201, result.text
    repeat = await client.post("/v1/candidate/documents", headers=headers, json=body)
    assert repeat.json()["id"] == result.json()["id"]
    return result.json()["id"]


async def test_private_document_application_sharing_withdrawal_and_durable_delete(client, vault):
    candidate = await register_candidate(client, "documents-a@example.invalid")
    other = await register_candidate(client, "documents-b@example.invalid")
    employer, eid = await verified_employer(client, "documents-owner@example.invalid")
    outsider, other_eid = await verified_employer(client, "documents-other-owner@example.invalid")
    data = file_bytes()
    did = await reserve(client, candidate, data)
    result = await client.put(
        f"/v1/candidate/documents/{did}/content",
        headers={**candidate, "Content-Type": "application/pdf"},
        content=data,
    )
    assert result.status_code == 200, result.text
    assert result.json()["verification"] == "not_verified"
    assert (await client.get("/v1/candidate/documents", headers=other)).json() == []
    assert (
        await client.get(f"/v1/candidate/documents/{did}/content", headers=other)
    ).status_code == 404
    assert (
        await client.get(f"/v1/candidate/documents/{did}/content", headers=employer)
    ).status_code == 403
    locations = (await client.get(f"/v1/employers/{eid}/locations", headers=employer)).json()
    job = await client.post(
        f"/v1/employers/{eid}/jobs",
        headers=employer,
        json={
            "title": "Fictional barista",
            "description": "Fixture only",
            "employment_type": "casual",
            "location_id": locations[0]["id"],
        },
    )
    jid = job.json()["id"]
    assert (
        await client.post(f"/v1/employers/{eid}/jobs/{jid}/publish", headers=employer)
    ).status_code == 200
    invalid = await client.post(
        f"/v1/jobs/{jid}/applications", headers=other, json={"document_ids": [did]}
    )
    assert invalid.status_code == 422
    application = await client.post(
        f"/v1/jobs/{jid}/applications", headers=candidate, json={"document_ids": [did]}
    )
    assert application.status_code == 201, application.text
    aid = application.json()["id"]
    base = f"/v1/employers/{eid}/applications/{aid}/documents"
    assert (await client.get(base, headers=employer)).json()[0]["id"] == did
    assert (await client.get(base + f"/{did}/content", headers=employer)).content == data
    assert (await client.get(base, headers=outsider)).status_code == 404
    assert (
        await client.get(
            f"/v1/employers/{other_eid}/applications/{aid}/documents", headers=outsider
        )
    ).status_code == 404
    assert (
        await client.post(f"/v1/candidate/applications/{aid}/withdraw", headers=candidate)
    ).status_code == 200
    assert (await client.get(base + f"/{did}/content", headers=employer)).status_code == 404
    assert (
        await client.delete(f"/v1/candidate/documents/{did}", headers=candidate)
    ).status_code == 204
    async with db_as() as session:
        count = await session.scalar(
            text("SELECT count(*) FROM document_deletions WHERE id=:id"), {"id": uuid.UUID(did)}
        )
        assert count == 1
        assert await documents.sweep_deletions(session) == 1


async def test_document_rls_is_forced_and_employers_cannot_query_vault(client, vault):
    candidate = await register_candidate(client, "vault-rls@example.invalid")
    did = await reserve(client, candidate, file_bytes())
    async with db_as("employer") as session:
        assert (await session.execute(text("SELECT id FROM candidate_documents"))).all() == []
        assert (await session.execute(text("SELECT id FROM document_deletions"))).all() == []
    async with db_as() as session:
        flags = (
            await session.execute(
                text(
                    "SELECT relrowsecurity,relforcerowsecurity FROM pg_class WHERE relname='candidate_documents'"
                )
            )
        ).one()
        assert flags == (True, True)
    assert (
        await client.delete(f"/v1/candidate/documents/{did}", headers=candidate)
    ).status_code == 204
