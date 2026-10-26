import uuid

from fastapi import APIRouter
from sqlalchemy import func, select

from app.audit import audit
from app.deps import Candidate, CurrentUser, Session
from app.errors import not_found
from app.models import CandidateProfile, CandidateSkill, Consent, Resume, ResumeVersion, Skill
from app.schemas import (
    ConsentIn,
    ProfileIn,
    ProfileOut,
    ResumeIn,
    ResumeOut,
    ResumeVersionIn,
)
from app.services.jobs import upsert_skills

router = APIRouter(prefix="/v1/candidate", tags=["candidate"])


async def _profile_out(session: Session, p: CandidateProfile) -> ProfileOut:
    names = await session.scalars(
        select(Skill.name)
        .join(CandidateSkill, CandidateSkill.skill_id == Skill.id)
        .where(CandidateSkill.candidate_id == p.id)
        .order_by(Skill.name)
    )
    out = ProfileOut.model_validate(p)
    out.skills = list(names)
    return out


@router.get("/profile", response_model=ProfileOut)
async def get_profile(profile: Candidate, session: Session) -> ProfileOut:
    return await _profile_out(session, profile)


@router.put("/profile", response_model=ProfileOut)
async def put_profile(body: ProfileIn, profile: Candidate, session: Session) -> ProfileOut:
    for field in (
        "full_name",
        "headline",
        "summary",
        "suburb",
        "state",
        "postcode",
        "preferred_employment_types",
        "min_hourly_pay",
        "max_commute_km",
    ):
        setattr(profile, field, getattr(body, field))
    skills = await upsert_skills(session, body.skills)
    wanted = {s.id for s in skills}
    existing = {
        cs.skill_id: cs
        for cs in await session.scalars(
            select(CandidateSkill).where(CandidateSkill.candidate_id == profile.id)
        )
    }
    for sid, cs in existing.items():
        if sid not in wanted:
            await session.delete(cs)
    for s in skills:
        if s.id not in existing:
            session.add(CandidateSkill(candidate_id=profile.id, skill_id=s.id))
    await session.flush()
    return await _profile_out(session, profile)


@router.put("/consents/talent-discovery", response_model=ProfileOut)
async def talent_discovery_consent(
    body: ConsentIn, profile: Candidate, user: CurrentUser, session: Session
) -> ProfileOut:
    """Opt-in only. Default is off; every change is recorded in the consent history."""
    profile.discoverable = body.granted
    session.add(Consent(user_id=user.id, kind="talent_discovery", granted=body.granted))
    await audit(session, user.id, "consent.talent_discovery", "user", user.id, granted=body.granted)
    await session.flush()
    return await _profile_out(session, profile)


@router.post("/resumes", response_model=ResumeOut, status_code=201)
async def create_resume(body: ResumeIn, profile: Candidate, session: Session) -> Resume:
    resume = Resume(candidate_id=profile.id, title=body.title)
    session.add(resume)
    await session.flush()
    session.add(ResumeVersion(resume_id=resume.id, version=1, content_text=body.content_text))
    await session.flush()
    await session.refresh(resume, ["versions"])
    return resume


@router.get("/resumes", response_model=list[ResumeOut])
async def list_resumes(profile: Candidate, session: Session) -> list[Resume]:
    return list(
        await session.scalars(
            select(Resume).where(Resume.candidate_id == profile.id).order_by(Resume.created_at)
        )
    )


async def _own_resume(session: Session, profile: CandidateProfile, resume_id: uuid.UUID) -> Resume:
    resume = (
        await session.scalars(
            select(Resume).where(Resume.id == resume_id, Resume.candidate_id == profile.id)
        )
    ).one_or_none()
    if resume is None:
        raise not_found("resume")
    return resume


@router.get("/resumes/{resume_id}", response_model=ResumeOut)
async def get_resume(resume_id: uuid.UUID, profile: Candidate, session: Session) -> Resume:
    return await _own_resume(session, profile, resume_id)


@router.post("/resumes/{resume_id}/versions", response_model=ResumeOut, status_code=201)
async def add_resume_version(
    resume_id: uuid.UUID, body: ResumeVersionIn, profile: Candidate, session: Session
) -> Resume:
    resume = await _own_resume(session, profile, resume_id)
    latest = await session.scalar(
        select(func.max(ResumeVersion.version)).where(ResumeVersion.resume_id == resume.id)
    )
    session.add(
        ResumeVersion(
            resume_id=resume.id, version=(latest or 0) + 1, content_text=body.content_text
        )
    )
    await session.flush()
    await session.refresh(resume, ["versions"])
    return resume
