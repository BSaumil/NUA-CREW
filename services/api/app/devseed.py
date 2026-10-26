"""Development-only fixture data. Refuses to run outside NUA_ENV=development.

All people and businesses below are fictional. Passwords are for local use only.
"""

import asyncio
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.db import dispose_engine, get_sessionmaker
from app.models import (
    CandidateProfile,
    CandidateSkill,
    Consent,
    Employer,
    EmployerMembership,
    Job,
    Location,
    Resume,
    ResumeVersion,
    User,
)
from app.schemas import JobIn
from app.security import hash_password
from app.services.jobs import apply_job_input, record_version, set_job_skills, upsert_skills

DEV_PASSWORD = "nua-dev-password-1"  # noqa: S105


async def _user(session: AsyncSession, email: str, role: str) -> User:
    existing = (await session.scalars(select(User).where(User.email == email))).one_or_none()
    if existing is not None:
        return existing
    user = User(email=email, password_hash=hash_password(DEV_PASSWORD), role=role)
    session.add(user)
    await session.flush()
    session.add(Consent(user_id=user.id, kind="terms", granted=True))
    return user


async def seed() -> None:
    if get_settings().env != "development":
        raise SystemExit("devseed refuses to run outside NUA_ENV=development")
    async with get_sessionmaker()() as session:
        await _user(session, "admin@nua-crew.example.com", "admin")

        employers = {}
        for key, name, abn, suburb, state, pc in (
            ("a", "Fictional Laneway Cafe", "51824753556", "Fitzroy", "VIC", "3065"),
            ("b", "Fictional Harbour Bistro", "53004085616", "Richmond", "VIC", "3121"),
        ):
            owner = await _user(session, f"owner-{key}@nua-crew.example.com", "employer")
            emp = (await session.scalars(select(Employer).where(Employer.abn == abn))).one_or_none()
            if emp is None:
                emp = Employer(
                    name=name,
                    abn=abn,
                    verification_status="verified",
                    verified_at=datetime.now(UTC),
                    verified_by=owner.id,  # dev fixture only; real verification is an admin action
                    verification_evidence="Development fixture",
                )
                session.add(emp)
                await session.flush()
                session.add(EmployerMembership(employer_id=emp.id, user_id=owner.id, role="owner"))
                session.add(
                    Location(
                        employer_id=emp.id,
                        name=f"{name} — {suburb}",
                        suburb=suburb,
                        state=state,
                        postcode=pc,
                    )
                )
                await session.flush()
            employers[key] = emp
        for email, key, role in (
            ("recruiter-a@nua-crew.example.com", "a", "recruiter"),
            ("viewer-a@nua-crew.example.com", "a", "viewer"),
        ):
            u = await _user(session, email, "employer")
            exists = await session.scalar(
                select(EmployerMembership.id).where(EmployerMembership.user_id == u.id)
            )
            if not exists:
                session.add(
                    EmployerMembership(employer_id=employers[key].id, user_id=u.id, role=role)
                )

        for key, title in (("a", "Barista"), ("b", "Kitchen Hand")):
            emp = employers[key]
            if await session.scalar(
                select(Job.id).where(Job.employer_id == emp.id, Job.title == title)
            ):
                continue
            loc = (
                await session.scalars(select(Location).where(Location.employer_id == emp.id))
            ).one()
            data = JobIn(
                title=title,
                description=f"{title} wanted at {emp.name}. Friendly team, weekend shifts.",
                employment_type="casual",
                category="Hospitality",
                location_id=loc.id,
                pay_min="28.00",
                pay_max="32.00",
                pay_period="hour",
                super_included=False,
                skills=["Barista", "Customer Service"] if key == "a" else ["Food Safety"],
            )
            job = Job(
                employer_id=emp.id,
                origin="direct",
                status="published",
                published_at=datetime.now(UTC),
                last_verified_at=datetime.now(UTC),
            )
            apply_job_input(job, data, loc)
            session.add(job)
            await session.flush()
            names = await set_job_skills(session, job, data.skills)
            await record_version(session, job, names, None)

        for key, name, suburb, skills in (
            ("a", "Alex Candidate", "Fitzroy", ["Barista", "Customer Service"]),
            ("b", "Bao Candidate", "Richmond", ["Food Safety"]),
        ):
            user = await _user(session, f"candidate-{key}@nua-crew.example.com", "candidate")
            profile = (
                await session.scalars(
                    select(CandidateProfile).where(CandidateProfile.user_id == user.id)
                )
            ).one_or_none()
            if profile is None:
                profile = CandidateProfile(
                    user_id=user.id,
                    full_name=name,
                    headline="Hospitality professional",
                    suburb=suburb,
                    state="VIC",
                    postcode="3065" if key == "a" else "3121",
                    preferred_employment_types=["casual"],
                    min_hourly_pay="27.00",
                )
                session.add(profile)
                await session.flush()
                for s in await upsert_skills(session, skills):
                    session.add(CandidateSkill(candidate_id=profile.id, skill_id=s.id))
                resume = Resume(candidate_id=profile.id, title=f"{name} resume")
                session.add(resume)
                await session.flush()
                session.add(
                    ResumeVersion(
                        resume_id=resume.id,
                        version=1,
                        content_text=f"{name}\nFictional resume. {', '.join(skills)}.",
                    )
                )
        await session.commit()
    await dispose_engine()


if __name__ == "__main__":
    asyncio.run(seed())
