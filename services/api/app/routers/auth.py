from fastapi import APIRouter, Request
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError

from app.audit import audit
from app.config import get_settings
from app.deps import CurrentUser, Session
from app.errors import ApiError, conflict
from app.models import (
    CandidateProfile,
    Consent,
    Employer,
    EmployerMembership,
    Location,
    User,
)
from app.ratelimit import get_limiter
from app.rls import system_scope
from app.schemas import (
    CandidateRegister,
    EmployerRegister,
    Login,
    MembershipOut,
    MeOut,
    RefreshIn,
    TokenOut,
)
from app.security import create_access_token, hash_password, verify_password
from app.services import tokens

router = APIRouter(prefix="/v1/auth", tags=["auth"])


async def _throttle(request: Request, scope: str, ident: str) -> None:
    ip = request.client.host if request.client else "unknown"
    limit = get_settings().auth_rate_limit_per_minute
    limiter = get_limiter()
    await limiter.check(f"{scope}:ip:{ip}", limit * 3)
    await limiter.check(f"{scope}:id:{ident.lower()}", limit)


async def _create_user(session: Session, email: str, password: str, role: str) -> User:
    user = User(email=email.strip(), password_hash=hash_password(password), role=role)
    session.add(user)
    try:
        async with session.begin_nested():
            await session.flush()
    except IntegrityError as exc:
        raise conflict("email_taken", "An account with this email already exists¶»§q«^