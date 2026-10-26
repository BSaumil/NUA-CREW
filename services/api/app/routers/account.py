"""Account self-service required by the app stores: export, password change, deletion."""

import json
from typing import Any

from fastapi import APIRouter, Response
from fastapi.encoders import jsonable_encoder
from sqlalchemy import delete, select, text

from app.audit import audit
from app.deps import CurrentUser, Session
from app.errors import ApiError, conflict
from app.models import (
    Application,
    ApplicationEvent,
    CandidateProfile,
    CandidateSkill,
    Consent,
    DeviceToken,
    EmployerMembership,
    Job,
    Notification,
    Resume,
    SavedJob,
    SavedSearch,
    Skill,
    User,
)
from app.rls import system_scope
from app.schemas import DeleteAccountIn, PasswordChangeIn
from app.security import hash_password, verify_password
from app.services import tokens

router = APIRouter(prefix="/v1/account", tags=["account"])


def _row(obj: Any, *cols: str) -> dict[str, Any]:
    return {c: getattr(obj, c) for c in cols}


@router.get("/export")
async def export_account(user: CurrentUser, session: Session) -> Response:
    """Everything NUA CREW holds about the caller, as JSON. Employer-authored notes are excluded:
    they are the employer's records, not the candidate's personal data."""
    data: dict[str, Any] = {
        "account": _row(user, "id", "email", "role", "created_at", "email_verified_at"),
        "consents": [
            _row(c, "kind", "granted", "created_at")
            for c in await session.scalars(select(Consent).where(Consent.user_id == user.id))
        ],
        "notifications": [
            _row(n, "kind", "title", "body", "created_at", "read_at")
            for n in await session.scalars(
                select(Notification).where(Notification.user_id == user.id)
            )
        ],
        "devices": [
            _row(d, "platform", "created_at", "last_seen_at")  # token itself is a credential
            for d in await session.scalars(
                select(DeviceToken).where(DeviceToken.user_id == user.id)
            )
        ],
    }
    if user.role == "employer":
        data["memberships"] = [
            _row(m, "employer_id", "role", "created_at")
            for m in await session.scalars(
                select(EmployerMembership).where(EmployerMembership.user_id == user.id)
            )
        ]
    if user.role == "candidate":
        p = (
            await session.scalars(
                select(CandidateProfile).where(CandidateProfile.user_id == user.id)
            )
        ).one()
        skills = await session.scalars(
            select(Skill.name)
            .join(CandidateSkill, CandidateSkill.skill_id == Skill.id)
            .where(CandidateSkill.candidate_id == p.id)
        )
        apps = []
        for a in await session.scalars(select(Application).where(Application.candidate_id == p.id)):
            job = await session.get(Job, a.job_id)
            events = await session.scalars(
                select(ApplicationEvent)
                .where(
                    ApplicationEvent.application_id == a.id, ApplicationEvent.visible_to_candidate
                )
                .order_by(ApplicationEvent.created_at)
            )
            apps.append(
                {
                    **_row(a, "id", "status", "cover_note", "created_at"),
                    "job_title": job.title if job else None,
                    "events": [
                        {
                            **_row(e, "event_type", "from_status", "to_status", "created_at"),
                            "note": e.note if e.actor_role == "candidate" else None,
                        }
                        for e in events
                    ],
                }
            )
        data["profile"] = {
            **_row(
                p,
                "full_name",
                "headline",
                "summary",
                "suburb",
                "state",
                "postcode",
                "preferred_employment_types",
                "min_hourly_pay",
                "max_commute_km",
                "discoverable",
                "push_enabled",
            ),  # fmt: skip
            "skills": sorted(skills),
        }
        data["resumes"] = [
            {
                "title": r.title,
                "versions": [_row(v, "version", "content_text", "created_at") for v in r.versions],
            }
            for r in await session.scalars(select(Resume).where(Resume.candidate_id == p.id))
        ]
        data["applications"] = apps
        data["saved_jobs"] = [
            str(j)
            for j in await session.scalars(
                select(SavedJob.job_id).where(SavedJob.candidate_id == p.id)
            )
        ]
        data["saved_searches"] = [
            _row(s, "name", "params", "alerts_enabled", "created_at")
            for s in await session.scalars(
                select(SavedSearch).where(SavedSearch.candidate_id == p.id)
            )
        ]
    body = json.dumps(jsonable_encoder(data), indent=2)
    return Response(
        body,
        media_type="application/json",
        headers={"Content-Disposition": 'attachment; filename="nua-crew-data-export.json"'},
    )


@router.post("/password", status_code=204)
async def change_password(body: PasswordChangeIn, user: CurrentUser, session: Session) -> Response:
    if not verify_password(body.current_password, user.password_hash):
        raise ApiError(403, "wrong_password", "Your current password is incorrect")
    user.password_hash = hash_password(body.new_password)
    async with system_scope(session):
        await tokens.revoke_all(session, user.id)  # every other device must sign in again
    await audit(session, user.id, "account.password_changed", "user", user.id)
    return Response(status_code=204)


@router.delete("", status_code=204)
async def delete_account(body: DeleteAccountIn, user: CurrentUser, session: Session) -> Response:
    """Permanently erase a candidate account and everything attached to it.

    Hiring records held by employers about this person (their application rows) go too; whether
    employers have a retention obligation is a legal question tracked in the launch gates.
    The audit trail is kept but only holds the (now orphaned) user id.
    """
    if not verify_password(body.password, user.password_hash):
        raise ApiError(403, "wrong_password", "Your password is incorrect")
    if user.role != "candidate":
        raise conflict(
            "contact_support",
            "Business accounts are closed through support so teammates keep access.",
        )
    await audit(session, user.id, "account.deleted", "user", user.id)
    async with system_scope(session):
        # Only audited deletion requests may remove append-only history.
        await session.execute(text("SELECT set_config('app.allow_erasure', 'on', true)"))
        await session.execute(delete(User).where(User.id == user.id))
        await session.flush()
        await session.execute(text("SELECT set_config('app.allow_erasure', '', true)"))
    return Response(status_code=204)
