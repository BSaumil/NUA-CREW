import io
import uuid
from datetime import date
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError
from pypdf import PdfWriter
from pypdf.generic import DictionaryObject, NameObject

from app.config import get_settings
from app.document_schemas import DocumentIn
from app.errors import ApiError
from app.models import CandidateDocument
from app.services import documents


def pdf():
    writer = PdfWriter()
    writer.add_blank_page(100, 100)
    buffer = io.BytesIO()
    writer.write(buffer)
    return buffer.getvalue()


def metadata(**changes):
    return DocumentIn.model_validate(
        {
            "kind": "resume",
            "title": "My resume",
            "filename": "resume.pdf",
            "content_type": "application/pdf",
            "size_bytes": 20,
            "client_key": "fixture-key",
            **changes,
        }
    )


@pytest.mark.parametrize(
    "change",
    [
        {"filename": "../resume.pdf"},
        {"filename": "resume.exe"},
        {"filename": "resume\n.pdf"},
        {"kind": "resume", "filename": "resume.png", "content_type": "image/png"},
        {"size_bytes": 0},
        {"size_bytes": 4 * 1024 * 1024 + 1},
        {"completed_on": "2026-10-01", "review_due_on": "2026-09-30"},
    ],
)
def test_invalid_metadata_is_refused(change):
    with pytest.raises(ValidationError):
        metadata(**change)


def test_storage_and_scanner_fail_closed(monkeypatch):
    s = get_settings()
    monkeypatch.setattr(s, "document_storage", "disabled")
    assert not documents.readiness()[0]
    monkeypatch.setattr(s, "document_storage", "local")
    monkeypatch.setattr(s, "env", "production")
    assert not documents.readiness()[0]
    monkeypatch.setattr(s, "env", "development")
    monkeypatch.setattr(s, "document_clamd_host", None)
    assert not documents.readiness()[0]


@pytest.mark.parametrize(
    "content_type,data",
    [
        ("application/pdf", b"<script>x</script>"),
        ("image/png", b"%PDF-not-an-image"),
        ("image/jpeg", b"not-a-jpeg"),
    ],
)
def test_contents_must_match_type(content_type, data):
    with pytest.raises(ApiError) as error:
        documents.validate_bytes(data, content_type)
    assert error.value.code == "invalid_file"


def test_pdf_validation_rejects_encrypted_and_active_files():
    documents.validate_pdf(pdf())
    for active in [False, True]:
        writer = PdfWriter()
        writer.add_blank_page(100, 100)
        if active:
            writer._root_object[NameObject("/OpenAction")] = DictionaryObject()
        else:
            writer.encrypt("private-password")
        buffer = io.BytesIO()
        writer.write(buffer)
        with pytest.raises(ApiError):
            documents.validate_pdf(buffer.getvalue())


@pytest.fixture
def local_storage(monkeypatch, tmp_path):
    s = get_settings()
    monkeypatch.setattr(s, "env", "development")
    monkeypatch.setattr(s, "document_storage", "local")
    monkeypatch.setattr(s, "document_local_root", str(tmp_path))
    monkeypatch.setattr(s, "document_clamd_host", "scanner.test")
    return tmp_path


async def test_no_bytes_are_released_when_scanner_is_unavailable(local_storage, monkeypatch):
    data = pdf()
    row = CandidateDocument(
        id=uuid.uuid4(),
        candidate_id=uuid.uuid4(),
        size_bytes=len(data),
        content_type="application/pdf",
        status="pending",
    )
    monkeypatch.setattr(
        documents,
        "scan",
        AsyncMock(side_effect=ApiError(503, "scanner_unavailable", "Unavailable")),
    )
    with pytest.raises(ApiError):
        await documents.store(row, data)
    assert row.status == "pending" and not list(local_storage.rglob("*"))


async def test_private_storage_integrity_and_idempotent_removal(local_storage, monkeypatch):
    data = pdf()
    row = CandidateDocument(
        id=uuid.uuid4(),
        candidate_id=uuid.uuid4(),
        size_bytes=len(data),
        content_type="application/pdf",
        status="pending",
    )
    monkeypatch.setattr(documents, "scan", AsyncMock())
    await documents.store(row, data)
    assert row.status == "ready" and row.scanned_at is not None
    assert await documents.download(row) == data
    path = local_storage / documents.key(row.candidate_id, row.id)
    path.write_bytes(b"changed")
    with pytest.raises(ApiError) as error:
        await documents.download(row)
    assert error.value.code == "file_integrity"
    documents._delete(documents.key(row.candidate_id, row.id))
    documents._delete(documents.key(row.candidate_id, row.id))


@pytest.mark.parametrize(
    "response,expected",
    [
        (b"stream: OK\x00", None),
        (b"stream: Eicar-Test-Signature FOUND\x00", "unsafe_file"),
        (b"UNKNOWN ERROR\x00", "scanner_unavailable"),
    ],
)
async def test_scanner_protocol_requires_explicit_clean_result(
    local_storage, monkeypatch, response, expected
):
    class Writer:
        def __init__(self):
            self.payload = bytearray()

        def write(self, data):
            self.payload.extend(data)

        async def drain(self):
            pass

        def close(self):
            pass

        async def wait_closed(self):
            pass

    writer = Writer()
    reader = AsyncMock()
    reader.readuntil.return_value = response
    monkeypatch.setattr(
        documents.asyncio, "open_connection", AsyncMock(return_value=(reader, writer))
    )
    if expected:
        with pytest.raises(ApiError) as error:
            await documents.scan(b"test-file")
        assert error.value.code == expected
    else:
        await documents.scan(b"test-file")
    assert writer.payload.startswith(b"zINSTREAM\x00")


def test_no_automatic_rsa_validity_is_inferred():
    record = metadata(
        kind="rsa", issuer="Fixture provider", jurisdiction="VIC", completed_on=date(2026, 1, 1)
    )
    assert record.review_due_on is None
