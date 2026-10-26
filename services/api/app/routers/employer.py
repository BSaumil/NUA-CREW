import uuid
from datetime import UTC, datetime

from fastapi import APIRouter
from sqlalchemy import func, select

from app.audit import audit
from app.deps import CurrentUser, Owner, Recruiter, Session, Viewer
from app.errors import ApiError, conflict, forbidden, not_found
from app.models import (
    Application,
    ApplicationEvent,
    CandidateProfile,
    CandidateSkill,
    Employer,
    EmployerMembership,
    Job,
    Location,
    ResumeVersion,
    Skill,
    User,
)
from app.schemas import (
    ApplicantOut,
    EmployerApplicationOut,
    EmployerOut,
    EventOut,
    JobIn,
    JobOut,
    LocationIn,
    LocationOut,
    MemberIn,
    MemberOut,
    NoteIn,
    StatusChangeIn,
)
from app.services.applications import change_status
from app.services.jobs import apply_job_input, record_version, set_job_skills, to_out

router = APIRouter(prefix="/v1/employers", tags=["employer"])


@router.get("", response_model=list[EmployerOut])
async def my_employers(user: CurrentUser, session: Session) -> list[Employer]:
    return list(
        await session.scalars(
            select(Employer)
            .join(EmployerMembership, EmployerMembership.employer_id == Employer.id)
            .where(EmployerMembership.user_id == user.id)
        )
    )


@router.get("/{employer_id}", response_model=EmployerOut)
async def get_employer(employer_id: uuid.UUID, _: Viewer, session: Session) -> Employer:
    employer = await session.get(Employer, employer_id)
    assert employer is not None  # noqa: S101 - membership FK
    return employer


# ---- locations / members ----
@router.get("/{employer_id}/locations", response_model=list[LocationOut])
async def list_locations(employer_id: uuid.UUID, _: Viewer, session: Session) -> list[Location]:
    return list(await session.scalars(select(Location).where(Location.employer_id == employer_id)))


@router.post("/{employer_id}/locations", response_model=LocationOut, status_code=201)
async def add_location(
    employer_id: uuid.UUID, body: LocationIn, _: Owner, session: Session
) -> Location:
    loc = Location(employer_id=employer_id, **body.model_dump())
    session.add(loc)
    await session.flush()
    return loc


@router.get("/{employer_id}/members", response_model=list[MemberOut])
async def list_members(employer_id: uuid.UUID, _: Viewer, session: Session) -> list[MemberOut]:
    rows = await session.execute(
        select(EmployerMembership.user_id, User.email, EmployerMembership.role)
        .join(User, User.id == EmployerMembership.user_id)
        .where(EmployerMembership.employer_id == employer_id)
    )
    return [MemberOut(user_id=u, email=e, role=r) for u, e, r in rows]


@router.post("/{employer_id}/members", response_model=MemberOut, status_code=201)
async def add_member(
    employer_id: uuid.UUID, body: MemberIn, owner: Owner, user: CurrentUser, session: Session
) -> MemberOut:
    # Interim: attach an existing employer-type account. Email invitations are future work.
    target = (
        await session.scalars(
            select(User).where(
                func.lower(User.email) == body.email.lower(), User.role == "employer"
            )
        )
    ).one_or_none()
    already = target and await session.scalar(
        select(EmployerMembership.id).where(
            EmployerMembership.employer_id == employer_id, EmployerMembership.user_id == target.id
        )
    )
    if target is None or already:
        raise ApiError(422, "cannot_add_member", "That person could not be added")
    session.add(EmployerMembership(employer_id=employer_id, user_id=target.id, role=body.role))
    audit(session, user.id, "employer.member_added", "employer", employer_id, role=body.role)
    await session.flush()
    return MemberOut(user_id=target.id, email=target.email, role=body.role)


# ---- jobs ----
async def _own_job(session: Session, employer_id: uuid.UUID, job_id: uuid.UUID) -> Job:
    job = (
        await session.scalars(select(Job).where(Job.id == job_id, Job.employer_id == employer_id))
    ).one_or_none()
    if job is None:
        raise not_found("job")
    return job


async def _location(
    session: Session, employer_id: uuid.UUID, location_id: uuid.UUID | None
) -> Location | None:
    if location_id is None:
        return None
    loc = (
        await session.scalars(
            select(Location).where(Location.id == location_id, Location.employer_id == employer_id)
        )
    ).one_or_none()
    if loc is None:
        raise ApiError(422, "invalid_location", "Location does not belong to this employer")
    return loc


@router.get("/{employer_id}/jobs", response_model=list[JobOut])
async def list_jobs(employer_id: uuid.UUID, _: Viewer, session: Session) -> list[JobOut]:
    jobs = list(
        await session.scalars(
            select(Job).where(Job.employer_id == employer_id).order_by(Job.created_at.desc())
        )
    )
    return await to_out(session, jobs)


@router.post("/{employer_id}/jobs", response_model=JobOut, status_code=201)
async def create_job(
    employer_id: uuid.UUID, body: JobIn, m: Recruiter, user: CurrentUser, session: Session
) -> JobOut:
    loc = await _location(session, employer_id, body.location_id)
    job = Job(employer_id=employer_id, origin="direct", status="draft", created_by=user.id)
    apply_job_input(job, body, loc)
    session.add(job)
    await session.flush()
    names = await set_job_skills(session, job, body.skills)
    await record_version(session, job, names, user.id)
    audit(session, user.id, "job.created", "job", job.id, employer_id=str(employer_id))
    return (await to_out(session, [job]))[0]


@router.get("/{employer_id}/jobs/{job_id}", response_model=JobOut)
async def get_job(employer_id: uuid.UUID, job_id: uuid.UUID, _: Viewer, session: Session) -> JobOut:
    return (await to_out(session, [await _own_job(session, employer_id, job_id)]))[0]


@router.put("/{employer_id}/jobs/{job_id}", response_model=JobOut)
async def update_job(
    employer_id: uuid.UUID,
    job_id: uuid.UUID,
    body: JobIn,
    _: Recruiter,
    user: CurrentUser,
    session: Session,
) -> JobOut:
    job = await _own_job(session, employer_id, job_id)
    if job.status in ("closed", "expired"):
        raise conflict("job_closed", "Closed jobs cannot be edited")
    apply_job_input(job, body, await _location(session, employer_id, body.location_id))
    await session.flush()
    names = await set_job_skills(session, job, body.skills)
    await record_version(session, job, names, user.id)
    audit(session, user.id, "job.updated", "job", job.id)
    return (await to_out(session, [job]))[0]


@router.post("/{employer_id}/jobs/{job_id}/publish", response_model=JobOut)
async def publish_job(
    employer_id: uuid.UUID, job_id: uuid.UUID, _: Recruiter, user: CurrentUser, session: Session
) -> JobOut:
    job = await _own_job(session, employer_id, job_id)
    employer = await session.get(Employer, employer_id)
    assert employer is not None  # noqa: S101
    if employer.verification_status != "verified":
        raise forbidden("This organisation must be verified before it can publish jobs")
    if job.status in ("closed", "expired"):
        raise conflict("job_closed", "Closed jobs cannot be republished")
    if not job.suburb:
        raise ApiError(422, "location_required", "A job location is required to publish")
    now = datetime.now(UTC)
    job.status, job.published_at, job.last_verified_at = "published", job.published_at or now, now
    await session.flush()
    names = [n for n in (await to_out(session, [job]))[0].skills]
    await record_version(session, job, names, user.id)
    audit(session, user.id, "job.published", "job", job.id)
    return (await to_out(session, [job]))[0]


@router.post("/{employer_id}/jobs/{job_id}/close", response_model=JobOut)
async def close_job(
    employer_id: uuid.UUID, job_id: uuid.UUID, _: Recruiter, user: CurrentUser, session: Session
) -> JobOut:
    job = await _own_job(session, employer_id, job_id)
    job.status = "closed"
    await session.flush()
    audit(session, user.id, "job.closed", "job", job.id)
    return (await to_out(session, [job]))[0]


# ---- applications (always scoped through the employer's own jobs) ----
async def _applicant_rows(
    session: Session, apps: list[Application], jobs: dict[uuid.UUID, Job]
) -> list[ApplicantOut]:
    if not apps:
        return []
    cands = {
        c.id: c
        for c in await session.scalars(
            select(CandidateProfile).where(CandidateProfile.id.in_({a.candidate_id for a in apps}))
        )
    }
    skill_rows = await session.execute(
        select(CandidateSkill.candidate_id, Skill.name)
        .join(Skill, Skill.id == CandidateSkill.skill_id)
        .where(CandidateSkill.candidate_id.in_(list(cands)))
        .order_by(Skill.name)
    )
    skills: dict[uuid.UUID, list[str]] = {}
    for cid, name in skill_rows:
        skills.setdefault(cid, []).append(name)
    return [
        ApplicantOut(
            application_id=a.id,
            status=a.status,
            created_at=a.created_at,
            full_name=cands[a.candidate_id].full_name,
            headline=cands[a.candidate_id].headline,
            suburb=cands[a.candidate_id].suburb,
            skills=skills.get(a.candidate_id, []),
        )
        for a in apps
    ]


@router.get("/{employer_id}/jobs/{job_id}/applications", response_model=list[ApplicantOut])
async def job_applications(
    employer_id: uuid.UUID, job_id: uuid.UUID, _: Viewer, session: Session
) -> list[ApplicantOut]:
    job = await _own_job(session, employer_id, job_id)
    apps = list(
        await session.scalars(
            select(Application)
            .where(Application.job_id == job.id, Application.status != "withdrawn")
            .order_by(Application.created_at)
        )
    )
    return await _applicant_rows(session, apps, {job.id: job})


async def _own_application(
    session: Session, employer_id: uuid.UUID, application_id: uuid.UUID
) -> tuple[Application, Job]:
    row = (
        await session.execute(
            select(Application, Job)
            .join(Job, Job.id == Application.job_id)
            .where(Application.id == application_id, Job.employer_id == employer_id)
        )
    ).one_or_none()
    if row is None:
        raise not_found("application")
    return row[0], row[1]


@router.get("/{employer_id}/applications/{application_id}", response_model=EmployerApplicationOut)
async def get_application(
    employer_id: uuid.UUID, application_id: uuid.UUID, _: Viewer, session: Session
) -> EmployerApplicationOut:
    app, job = await _own_application(session, employer_id, application_id)
    base = (await _applicant_rows(session, [app], {job.id: job}))[0]
    cand = await session.get(CandidateProfile, app.candidate_id)
    resume_text = None
    if app.resume_version_id:
        rv = await session.get(ResumeVersion, app.resume_version_id)
        resume_text = rv.content_text if rv else None
    events = await session.scalars(
        select(ApplicationEvent)
        .where(ApplicationEvent.application_id == app.id)
        .order_by(ApplicationEvent.created_at, ApplicationEvent.id)
    )
    return EmployerApplicationOut(
        **base.model_dump(),
        job_id=job.id,
        job_title=job.title,
        summary=cand.summary if cand else None,
        cover_note=app.cover_note,
        resume_text=resume_text,
        events=[EventOut.model_validate(e) for e in events],
    )


@router.post(
    "/{employer_id}/applications/{application_id}/status", response_model=EmployerApplicationOut
)
async def set_status(
    employer_id: uuid.UUID,
    application_id: uuid.UUID,
    body: StatusChangeIn,
    _: Recruiter,
    user: CurrentUser,
    session: Session,
) -> EmployerApplicationOut:
    app, job = await _own_application(session, employer_id, application_id)
    await change_status(session, app, job, user, body.to_status, body.note)
    return await get_application(employer_id, application_id, _, session)


@router.post(
    "/{employer_id}/applications/{application_id}/notes",
    response_model=EmployerApplicationOut,
    status_code=201,
)
async def add_note(
    employer_id: uuid.UUID,
    application_id: uuid.UUID,
    body: NoteIn,
    _: Recruiter,
    user: CurrentUser,
    session: Session,
) -> EmployerApplicationOut:
    app, _job = await _own_application(session, employer_id, application_id)
    session.add(
        ApplicationEvent(
            application_id=app.id,
            event_type="note",
            actor_user_id=user.id,
            actor_role="employer",
            visible_to_candidate=False,  # private to the hiring team
            note=body.note,
        )
    )
    await session.flush()
    return await get_application(employer_id, application_id, _, session)
