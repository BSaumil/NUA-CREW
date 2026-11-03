"""Private immutable document bytes; no clean result without a real scanner response."""

import asyncio
import hashlib
import io
import os
import struct
import uuid
from datetime import UTC, datetime
from pathlib import Path
from typing import TYPE_CHECKING, cast

from pypdf.generic import DictionaryObject

if TYPE_CHECKING:
    from mypy_boto3_s3 import S3Client

import boto3
from pypdf import PdfReader
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.errors import ApiError
from app.models import CandidateDocument, DocumentDeletion

MAX_BYTES = 4 * 1024 * 1024


def readiness() -> tuple[bool, str]:
    s = get_settings()
    if s.document_storage == "disabled":
        return False, "Document uploads are not connected yet. You can still paste resume text."
    if s.document_storage == "local" and s.env != "development":
        return False, "Private durable document storage must be configured."
    if s.document_storage == "s3" and not s.document_s3_bucket:
        return False, "Private document storage must be configured."
    if not s.document_clamd_host:
        return False, "Document scanning must be configured before uploads are available."
    return True, "Files are scanned before availability. Uploading does not verify a qualification."


def require_ready() -> None:
    ready, message = readiness()
    if not ready:
        raise ApiError(503, "documents_unavailable", message)


def key(candidate_id: uuid.UUID, document_id: uuid.UUID) -> str:
    return f"documents/{candidate_id.hex}/{document_id.hex}"


async def scan(data: bytes) -> None:
    s = get_settings()
    if not s.document_clamd_host:
        raise ApiError(503, "scanner_unavailable", "Scanning is unavailable. Retry later.")
    writer: asyncio.StreamWriter | None = None
    try:
        async with asyncio.timeout(30):
            reader, writer = await asyncio.open_connection(
                s.document_clamd_host, s.document_clamd_port, limit=4096
            )
            writer.write(b"zINSTREAM\x00")
            for offset in range(0, len(data), 65536):
                chunk = data[offset : offset + 65536]
                writer.write(struct.pack("!I", len(chunk)) + chunk)
                await writer.drain()
            writer.write(struct.pack("!I", 0))
            await writer.drain()
            result = await reader.readuntil(b"\x00")
            if result == b"stream: OK\x00":
                return
            if result.endswith(b" FOUND\x00"):
                raise ApiError(
                    422,
                    "unsafe_file",
                    "This file was rejected by the malware scanner. Choose another file.",
                )
            raise ApiError(
                503, "scanner_unavailable", "Scanning could not be completed. Retry later."
            )
    except (OSError, TimeoutError, asyncio.IncompleteReadError, asyncio.LimitOverrunError) as exc:
        raise ApiError(503, "scanner_unavailable", "Scanning is unavailable. Retry later.") from exc
    finally:
        if writer:
            writer.close()
            try:
                await writer.wait_closed()
            except OSError:
                pass  # The scan result or connection error above remains authoritative.


def validate_bytes(data: bytes, content_type: str) -> None:
    if not data or len(data) > MAX_BYTES:
        raise ApiError(413, "file_too_large", "Choose a file up to 4 MB.")
    valid = (
        content_type == "application/pdf"
        and data.startswith(b"%PDF-")
        or content_type == "image/png"
        and data.startswith(b"\x89PNG\r\n\x1a\n")
        or content_type == "image/jpeg"
        and data.startswith(b"\xff\xd8\xff")
    )
    if not valid:
        raise ApiError(422, "invalid_file", "The file contents do not match its declared type.")


def validate_pdf(data: bytes) -> None:
    try:
        reader = PdfReader(io.BytesIO(data), strict=True)
        if reader.is_encrypted or len(reader.pages) > 200 or not reader.pages:
            raise ValueError("Unsupported PDF")
        root = cast(DictionaryObject, reader.trailer["/Root"])
        if "/OpenAction" in root or "/AA" in root:
            raise ValueError("Active PDF")
        names = root.get("/Names", {})
        if "/JavaScript" in names or "/EmbeddedFiles" in names:
            raise ValueError("Active PDF")
    except Exception as exc:
        raise ApiError(
            422,
            "invalid_pdf",
            "Choose an unencrypted PDF, without embedded files or actions, up to 200 pages.",
        ) from exc


def _local_path(object_key: str) -> Path:
    # Keys are generated from UUIDs, never filenames or client paths.
    return Path(get_settings().document_local_root).resolve() / object_key


def _s3() -> "S3Client":
    return boto3.client("s3", region_name=get_settings().document_s3_region)


def _put(object_key: str, data: bytes) -> None:
    s = get_settings()
    if s.document_storage == "local" and s.env == "development":
        path = _local_path(object_key)
        path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
        with os.fdopen(fd, "wb") as out:
            out.write(data)
    elif s.document_storage == "s3" and s.document_s3_bucket:
        _s3().put_object(
            Bucket=s.document_s3_bucket,
            Key=object_key,
            Body=data,
            ServerSideEncryption="AES256",
            ContentType="application/octet-stream",
        )
    else:
        raise ApiError(503, "storage_unavailable", "Private document storage is unavailable.")


def _get(object_key: str) -> bytes:
    s = get_settings()
    if s.document_storage == "local" and s.env == "development":
        return _local_path(object_key).read_bytes()
    if s.document_storage == "s3" and s.document_s3_bucket:
        result = _s3().get_object(Bucket=s.document_s3_bucket, Key=object_key)
        try:
            return bytes(result["Body"].read(MAX_BYTES + 1))
        finally:
            result["Body"].close()
    raise ApiError(503, "storage_unavailable", "Private document storage is unavailable.")


def _delete(object_key: str) -> None:
    s = get_settings()
    if s.document_storage == "local" and s.env == "development":
        _local_path(object_key).unlink(missing_ok=True)
    elif s.document_storage == "s3" and s.document_s3_bucket:
        _s3().delete_object(Bucket=s.document_s3_bucket, Key=object_key)
    else:
        raise ApiError(503, "storage_unavailable", "Private document storage is unavailable.")


async def store(document: CandidateDocument, data: bytes) -> None:
    require_ready()
    validate_bytes(data, document.content_type)
    await scan(data)
    if document.content_type == "application/pdf":
        await asyncio.to_thread(validate_pdf, data)
    try:
        await asyncio.to_thread(_put, key(document.candidate_id, document.id), data)
    except ApiError:
        raise
    except Exception as exc:
        raise ApiError(
            503, "storage_unavailable", "The upload could not be saved. Retry safely."
        ) from exc
    document.sha256 = hashlib.sha256(data).hexdigest()
    document.scanned_at = datetime.now(UTC)
    document.status = "ready"


async def download(document: CandidateDocument) -> bytes:
    if document.status != "ready":
        raise ApiError(409, "document_not_ready", "This file is not available yet.")
    require_ready()
    try:
        data = await asyncio.to_thread(_get, key(document.candidate_id, document.id))
    except Exception as exc:
        raise ApiError(503, "storage_unavailable", "The file is temporarily unavailable.") from exc
    if len(data) != document.size_bytes or hashlib.sha256(data).hexdigest() != document.sha256:
        raise ApiError(503, "file_integrity", "This file could not be verified. Contact support.")
    return data


async def sweep_deletions(session: AsyncSession) -> int:
    rows = list(
        await session.scalars(
            select(DocumentDeletion)
            .order_by(DocumentDeletion.id)
            .limit(50)
            .with_for_update(skip_locked=True)
        )
    )
    completed = 0
    for row in rows:
        try:
            await asyncio.to_thread(_delete, key(row.candidate_id, row.id))
        except Exception:
            row.attempts += 1
        else:
            await session.delete(row)
            completed += 1
    return completed
