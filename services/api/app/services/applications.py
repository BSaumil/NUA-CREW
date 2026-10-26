import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import audit
from app.errors import conflict
from app.models import (
    Application,
    ApplicationEvent,
    EmployerMembership,
    Job,
    User,
)
from app.services.notify import notify

# Employer-driven pipeline. Terminal states cannot move; a human always decides.
EMPLOYER_TRANSITIONS: dict[str, set[str]] = {
    "submitted": {"under_review", "rejected"},
    "under_review": {"shortlisted", "rejected"},
    "shortlisted": {"interview", "rejected"},
    "interview": {"offer", "rejected"},
    "offer": {"hired", "rejected"},
}
TERMINAL = {"hired", "rejected", "withdrawn"}

STATUS_LABEL = {
    "under_review": "is under review",
    "shortlisted": "has been shortlisted",
    "interview": "has moved to interview",
    "offer": "has an offer",
    "hired": "was marked as hired",
    "rejected": "was not progressed",
}


def check_employer_transition(current: str, target: str) -> None:
    if target not in EMPLOYER_TRANSITIONS.get(current, set()):
        raise conflict(
            "invalid_transition", f"Cannot move an application from {current} to {target}"
        )


async def change_status(
    session: AsyncSession,
    app: Application,
    job: Job,
    actor: User,
    target: str,
    note: str | None,
) -> None:
    check_employer_transition(app.status, target)
    previous = app.status
    app.status = target
    session.add(
        ApplicationEvent(
            application_id=app.id,
            event_type="status_changed",
            from_status=previous,
            to_status=target,
            actor_user_id=actor.id,
            actor_role="employer",
            note=note,
            # Rejection reasons stay internal; the candidate sees the status change itself.
            visible_to_candidate=True,
        )
    )
    audit(
        session,
        actor.id,
        "application.status_changed",
        "application",
        app.id,
        from_status=previous,
        to_status=target,
        employer_id=str(job.employer_id),
    )
    from app.models import CandidateProfile  # local import avoids a cycle in type checking

    cand = await session.get(CandidateProfile, app.candidate_id)
    if cand is not None:
        notify(
            session,
            cand.user_id,
            "application.status_changed",
            f"Your application for {job.title} {STATUS_LABEL[target]}",
            None,
            application_id=str(app.id),
            status=target,
        )
    await session.flush()


async def notify_employer_team(
    session: AsyncSession, job: Job, title: str, application_id: uuid.UUID
) -> None:
    if job.employer_id is None:
        return
    members = await session.scalars(
        select(EmployerMembership).where(
            EmployerMembership.employer_id == job.employer_id,
            EmployerMembership.role.in_(("owner", "recruiter")),
        )
    )
    for m in members:
        notify(
            session,
            m.user_id,
            "application.received",
            title,
            None,
            application_id=str(application_id),
            job_id=str(job.id),
        )
