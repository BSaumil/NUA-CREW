import uuid
from typing import Annotated

from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.errors import ApiError, forbidden, not_found
from app.models import CandidateProfile, EmployerMembership, User
from app.rls import set_context
from app.security import decode_access_token

_bearer = HTTPBearer(auto_error=False)

Session = Annotated[AsyncSession, Depends(get_session)]


async def current_user(
    session: Session,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User:
    if creds is None:
        raise ApiError(401, "unauthenticated", "Authentication required")
    claims = decode_access_token(creds.credentials)
    user = await session.get(User, uuid.UUID(str(claims["sub"])))
    if user is None or not user.is_active:
        raise ApiError(401, "unauthenticated", "Authentication required")
    await _bind_rls_context(session, user)
    return user


async def _bind_rls_context(session: AsyncSession, user: User) -> None:
    """Tell Postgres who is asking so row-level security can enforce isolation (ADR-003)."""
    await set_context(session, user_id=user.id, role=user.role)
    employer_ids: list[uuid.UUID] = []
    candidate_id: uuid.UUID | None = None
    if user.role == "employer":
        employer_ids = list(
            await session.scalars(
                select(EmployerMembership.employer_id).where(EmployerMembership.user_id == user.id)
            )
        )
    elif user.role == "candidate":
        candidate_id = await session.scalar(
            select(CandidateProfile.id).where(CandidateProfile.user_id == user.id)
        )
    await set_context(
        session,
        user_id=user.id,
        role=user.role,
        candidate_id=candidate_id,
        employer_ids=employer_ids,
    )


CurrentUser = Annotated[User, Depends(current_user)]


async def optional_user(
    session: Session,
    creds: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)],
) -> User | None:
    if creds is None:
        return None
    return await current_user(session, creds)


OptionalUser = Annotated[User | None, Depends(optional_user)]


async def admin_user(user: CurrentUser) -> User:
    if user.role != "admin":
        raise forbidden()
    return user


AdminUser = Annotated[User, Depends(admin_user)]


async def candidate_profile(user: CurrentUser, session: Session) -> CandidateProfile:
    if user.role != "candidate":
        raise forbidden("Candidate account required")
    profile = (
        await session.scalars(select(CandidateProfile).where(CandidateProfile.user_id == user.id))
    ).one_or_none()
    if profile is None:
        raise not_found("candidate profile")
    return profile


Candidate = Annotated[CandidateProfile, Depends(candidate_profile)]

_RANK = {"viewer": 1, "recruiter": 2, "owner": 3}


async def _membership(
    employer_id: uuid.UUID, user: User, session: AsyncSession, minimum: str
) -> EmployerMembership:
    m = (
        await session.scalars(
            select(EmployerMembership).where(
                EmployerMembership.employer_id == employer_id,
                EmployerMembership.user_id == user.id,
            )
        )
    ).one_or_none()
    if m is None:
        raise not_found("employer")  # non-members cannot learn the tenant exists
    if _RANK[m.role] < _RANK[minimum]:
        raise forbidden(f"Requires {minimum} role")
    return m


async def member_viewer(
    employer_id: uuid.UUID, user: CurrentUser, session: Session
) -> EmployerMembership:
    return await _membership(employer_id, user, session, "viewer")


async def member_recruiter(
    employer_id: uuid.UUID, user: CurrentUser, session: Session
) -> EmployerMembership:
    return await _membership(employer_id, user, session, "recruiter")


async def member_owner(
    employer_id: uuid.UUID, user: CurrentUser, session: Session
) -> EmployerMembership:
    return await _membership(employer_id, user, session, "owner")


Viewer = Annotated[EmployerMembership, Depends(member_viewer)]
Recruiter = Annotated[EmployerMembership, Depends(member_recruiter)]
Owner = Annotated[EmployerMembership, Depends(member_owner)]
