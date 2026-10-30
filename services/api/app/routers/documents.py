import hashlib
import uuid

from fastapi import APIRouter, Request, Response
from sqlalchemy import select

from app.audit import audit
from app.deps import Candidate, CurrentUser, Session, Viewer
from app.document_schemas import DocumentIn, DocumentOut
from app.errors import ApiError, conflict, not_found
from app.models import Application, ApplicationDocument, CandidateDocument, CandidateProfile, Job
from app.ratelimit import get_limiter
from app.rls import system_scope
from app.services import documents as files

router = APIRouter(prefix="/v1", tags=["documents"])


@router.get("/documents/status")
async def status(user: CurrentUser) -> dict[str, object]:
    ready, message = files.readiness()
    return {
        "upload_enabled": ready,
        "message": message,
        "max_bytes": files.MAX_BYTES,
        "resume_types": ["application/pdf"],
        "certificate_types": ["application/pdf", "image/jpeg", "image/png"],
    }


async def mine(
    session: Session, candidate_id: uuid.UUID, document_id: uuid.UUID, *, lock: bool = False
) -> CandidateDocument:
    query = select(CandidateDocument).where(
        CandidateDocument.id == document_id, CandidateDocument.candidate_id == candidate_id
    )
    if lock:
        query = query.with_for_update()
    row = await session.scalar(query)
    if row is None:
        raise not_found("document")
    return row


@router.get("/candidate/documents", response_model=list[DocumentOut])
async def list_documents(candidate: Candidate, session: Session) -> list[CandidateDocument]:
    return list(
        await session.scalars(
            select(CandidateDocument)
            .where(CandidateDocument.candidate_id == candidate.id)
            .order_by(CandidateDocument.created_at.desc())
        )
    )


@router.post("/candidate/documents", response_model=DocumentOut, status_code=201)
async def create(
    body: DocumentIn, candidate: Candidate, user: CurrentUser, session: Session
) -> CandidateDocument:
    files.require_ready()
    await get_limiter().check(f"document-create:{user.id}", 30, 3600)
    # Serialise reservations so a candidate cannot race the bounded vault limit.
    await session.scalar(
        select(CandidateProfile).where(CandidateProfile.id == candidate.id).with_for_update()
    )
    rows = list(
        await session.scalars(
            select(CandidateDocument).where(CandidateDocument.candidate_id == candidate.id)
        )
    )
    for row in rows:
        if row.client_key == body.client_key:
            if any(getattr(row, field) != value for field, value in body.model_dump().items()):
                raise conflict(
                    "idempotency_mismatch", "Retry the original upload or choose a new file."
                )
            return row
    if len(rows) >= 30:
        raise conflict("vault_full", "Remove an older document before uploading another.")
    row = CandidateDocument(candidate_id=candidate.id, **body.model_dump())
    session.add(row)
    await session.flush()
    await session.refresh(row)
    await audit(session, user.id, "document.reserved", "document", row.id)
    return row


@router.put("/candidate/documents/{document_id}/content", response_model=DocumentOut)
async def upload(
    document_id: uuid.UUID,
    request: Request,
    candidate: Candidate,
    user: CurrentUser,
    session: Session,
) -> CandidateDocument:
    files.require_ready()
    await get_limiter().check(f"document-upload:{user.id}", 30, 3600)
    row = await mine(session, candidate.id, document_id, lock=True)
    if request.headers.get("content-type", "").split(";")[0].lower() != row.content_type:
        raise ApiError(422, "invalid_file_type", "The upload type must match the chosen document.")
    data = bytearray()
    async for chunk in request.stream():
        if len(data) + len(chunk) > min(files.MAX_BYTES, row.size_bytes):
            raise ApiError(413, "file_too_large", "The uploaded file exceeds its declared size.")
        data.extend(chunk)
    raw = bytes(data)
    if len(raw) != row.size_bytes:
        raise ApiError(422, "incomplete_file", "The upload was incomplete. Retry the same file.")
    if row.status == "ready":
        if hashlib.sha256(raw).hexdigest() != row.sha256:
            raise conflict(
                "immutable_document", "Saved files cannot be overwritten. Upload a new version."
            )
        return row
    await files.store(row, raw)
    await session.flush()
    await audit(session, user.id, "document.uploaded", "document", row.id)
    return row


def attachment(data: bytes, row: CandidateDocument) -> Response:
    suffix = {"application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png"}[row.content_type]
    return Response(
        data,
        media_type=row.content_type,
        headers={
            "Content-Disposition": f'attachment; filename="document.{suffix}"',
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox; default-src 'none'",
        },
    )


@router.get("/candidate/documents/{document_id}/content")
async def own_content(
    document_id: uuid.UUID, candidate: Candidate, user: CurrentUser, session: Session
) -> Response:
    row = await mine(session, candidate.id, document_id)
    data = await files.download(row)
    await audit(session, user.id, "document.downloaded", "document", row.id)
    return attachment(data, row)


@router.delete("/candidate/documents/{document_id}", status_code=204)
async def delete(
    document_id: uuid.UUID, candidate: Candidate, user: CurrentUser, session: Session
) -> Response:
    row = await mine(session, candidate.id, document_id, lock=True)
    await session.delete(row)  # Trigger persists storage cleanup in the same transaction.
    await session.flush()
    await audit(session, user.id, "document.deleted", "document", document_id)
    return Response(status_code=204)


async def employer_application(
    employer_id: uuid.UUID, application_id: uuid.UUID, session: Session
) -> Application:
    row = await session.scalar(
        select(Application)
        .join(Job, Job.id == Application.job_id)
        .where(Application.id == application_id, Job.employer_id == employer_id)
    )
    if row is None or row.status == "withdrawn":
        raise not_found("application")
    return row


@router.get(
    "/employers/{employer_id}/applications/{application_id}/documents",
    response_model=list[DocumentOut],
)
async def shared(
    employer_id: uuid.UUID, application_id: uuid.UUID, membership: Viewer, session: Session
) -> list[CandidateDocument]:
    app = await employer_application(employer_id, application_id, session)
    async with system_scope(session):
        return list(
            await session.scalars(
                select(CandidateDocument)
                .join(ApplicationDocument, ApplicationDocument.document_id == CandidateDocument.id)
                .where(
                    ApplicationDocument.application_id == app.id,
                    ApplicationDocument.candidate_id == app.candidate_id,
                    CandidateDocument.candidate_id == app.candidate_id,
                    CandidateDocument.status == "ready",
                )
            )
        )


@router.get(
    "/employers/{employer_id}/applications/{application_id}/documents/{document_id}/content"
)
async def shared_content(
    employer_id: uuid.UUID,
    application_id: uuid.UUID,
    document_id: uuid.UUID,
    membership: Viewer,
    user: CurrentUser,
    session: Session,
) -> Response:
    rows = await shared(employer_id, application_id, membership, session)
    row = next((row for row in rows if row.id == document_id), None)
    if row is None:
        raise not_found("document")
    data = await files.download(row)
    await audit(
        session,
        user.id,
        "document.shared_downloaded",
        "application",
        application_id,
        document_id=str(document_id),
    )
    return attachment(data, row)
