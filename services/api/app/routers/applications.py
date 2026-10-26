import uuid
from typing import Annotated

from fastapi import APIRouter, Header
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.audit import audit
from app.deps import Candidate, CurrentUser, Session
from app.errors import ApiError, conflict, not_found
from app.models import Application, ApplicationEvent, Employer, Job, Resume, ResumeVersion
from app.schemas import (
    ApplicationJobOut,
    ApplyIn,
    CandidateApplicationOut,
    EventOut,
)
from app.services.applications import TERMINAL, notify_employer_team
from app.services.jobs import is_open

router = APIRouter(tags=["applications"])


def _events_for_candidate(events: list[ApplicationEvent]) -> list[EventOut]:
    out = []
    for e in events:
        if not e.visible_to_candidate:
            continue
        o = EventOut.model_validate(e)
        if e.actor_role != "candidate":
            o.note = None  # employer notes and rejection reasons are internal
        out.append(o)
    return out


async def _view(session: Session, app: Application, with_events: bool) -> CandidateApplicationOut:
    await session.refresh(app)  # server-side defaults (updated_at) are expired after flush
    job = await session.get(Job, app.job_id)
    assert job is not None  # noqa: S101
    emp = await session.get(Employer, job.employer_id) if job.employer_id else None
    events: list[EventOut] = []
    if with_events:
        rows = list(
            await session.scalars(
                select(ApplicationEvent)
                .where(ApplicationEvent.application_id == app.id)
                .order_by(ApplicationEvent.created_at, ApplicationEvent.id)
            )
        )
        events = _events_for_candidate(rows)
    return CandidateApplicationOut(
        id=app.id,
        status=app.status,
        cover_note=app.cover_note,
        created_at=app.created_at,
        updated_at=app.updated_at,
        job=ApplicationJobOut(
            id=job.id,
            title=job.title,
            employer_name=emp.name if emp else job.source_employer_name,
            suburb=job.suburb,
            status=job.status,
        ),
        events=events,
    )


@router.post(
    "/v1/jobs/{job_id}/applications", response_model=CandidateApplicationOut, status_code=201
)
async def apply(
    job_id: uuid.UUID,
    body: ApplyIn,
    candidate: Candidate,
    user: CurrentUser,
    session: Session,
    idempotency_key: Annotated[str | None, Header(max_length=100)] = None,
) -> CandidateApplicationOut:
    job = await session.get(Job, job_id)
    if job is None or not is_open(job):
        raise not_found("job")
    if job.origin != "direct":
        raise conflict(
            "external_application",
            "This job is hosted elsewhere. Apply on the employer's site using the apply link.",
        )
    if idempotency_key:
        prior = (
            await session.scalars(
                select(Application).where(
                    Application.candidate_id == candidate.id,
                    Application.idempotency_key == idempotency_key,
                    Application.job_id == job.id,
                )
            )
        ).one_or_none()
        if prior:
            return await _view(session, prior, True)

    resume_version_id = None
    if body.resume_id:
        resume = (
            await session.scalars(
                select(Resume).where(
                    Resume.id == body.resume_id, Resume.candidate_id == candidate.id
                )
            )
        ).one_or_none()
        if resume is None:
            raise ApiError(422, "invalid_resume", "Resume not found")
        resume_version_id = resume.versions[-1].id if resume.versions else None

    app = Application(
        job_id=job.id,
        candidate_id=candidate.id,
        resume_version_id=resume_version_id,
        cover_note=body.cover_note,
        status="submitted",
        idempotency_key=idempotency_key,
    )
    session.add(app)
    try:
        async with session.begin_nested():
            await session.flush()
    except IntegrityError as exc:
        raise conflict(
            "already_applied", "You already have an active application for this job"
        ) from exc
    session.add(
        ApplicationEvent(
            application_id=app.id,
            event_type="submitted",
            to_status="submitted",
            actor_user_id=user.id,
            actor_role="candidate",
        )
    )
    await notify_employer_team(
        session, job, f"New application for {job.title} from {candidate.full_name}", app.id
    )
    audit(session, user.id, "application.submitted", "application", app.id, job_id=str(job.id))
    await session.flush()
    return await _view(session, app, True)


@router.get("/v1/candidate/applications", response_model=list[CandidateApplicationOut])
async def my_applications(candidate: Candidate, session: Session) -> list[CandidateApplicationOut]:
    apps = await session.scalars(
        select(Application)
        .where(Application.candidate_id == candidate.id)
        .order_by(Application.created_at.desc())
    )
    return [await _view(session, a, False) for a in apps]


async def _mine(
    session: Session, candidate_id: uuid.UUID, application_id: uuid.UUID
) -> Application:
    app = (
        await session.scalars(
            select(Application).where(
                Application.id == application_id, Application.candidate_id == candidate_id
            )
        )
    ).one_or_none()
    if app is None:
        raise not_found("application")
    return app


@router.get("/v1/candidate/applications/{application_id}", response_model=CandidateApplicationOut)
async def my_application(
    application_id: uuid.UUID, candidate: Candidate, session: Session
) -> CandidateApplicationOut:
    return await _view(session, await _mine(session, candidate.id, application_id), True)


@router.post(
    "/v1/candidate/applications/{application_id}/withdraw", response_model=CandidateApplicationOut
)
async def withdraw(
    application_id: uuid.UUID, candidate: Candidate, user: CurrentUser, session: Session
) -> CandidateApplicationOut:
    app = await _mine(session, candidate.id, application_id)
    if app.status in TERMINAL:
        raise conflict("invalid_transition", f"A {app.status} application cannot be withdrawn")
    previous, app.status = app.status, "withdrawn"
    session.add(
        ApplicationEvent(
            application_id=app.id,
            event_type="withdrawn",
            from_status=previous,
            to_status="withdrawn",
            actor_user_id=user.id,
            actor_role="candidate",
        )
    )
    audit(session, user.id, "application.withdrawn", "application", app.id)
    await session.flush()
    return await _view(session, app, True)


# ResumeVersion imported for type resolution of relationship loading
_ = ResumeVersion
