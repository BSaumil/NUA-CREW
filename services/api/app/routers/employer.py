import uuid
from datetime import UTC, datetime

from fastapi import APIRouter
from sqlalchemy import func, select

from app.audit import audit
from app.config import get_settings
from app.deps import CurrentUser, Owner, Recruiter, Session, Viewer
from app.errors import ApiError, conflict, forbidden, not_found
from app.models import (
    AdEntitlement,
    Application,
    ApplicationEvent,
    BillingOrder,
    CandidateProfile,
    CandidateSkill,
    Employer,
    EmployerMembership,
    Job,
    Location,
    PromotionReservation,
    ResumeVersion,
    Skill,
    User,
)
from app.ratelimit import get_limiter
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
from app.services.hospitality.pay import enforce_on_publish
from app.services.jobs import (
    apply_job_input,
    record_version,
    set_job_skills,
    to_out,
    validate_hospitality_links,
)

router = APIRouter(prefix="/v1/employers", tags=["employer"])


@router.get("", response_model=list[EmployerOut])
async def my_employers(user: CurrentUser, session: Session) -> list[Employer]:
    return list(
        await session.scalars(
            select(Employer)
            .join(EmployerMembership, EmployerMembership.employer_id == Employer.id)
            .where(EmployerMembership.user_id == u¶»§q«^