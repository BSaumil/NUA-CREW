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
from app.rls import system_scope
from app.schemas import (
    CandidateRegister,
    EmployerRegister,
    Login,
    MembershipOut,
    MeOut,
    TokenOut,
)
from app.security import auth_limiter, create_access_token, hash_password, verify_password

router = APIRouter(prefix="/v1/auth", tags=["auth"])


def _throttle(request: Request, scope: str, ident: str) -> None:
    ip = request.client.host if request.client else "unknown"
    limit = get_settings().auth_rate_limit_per_minute
    auth_limiter.check(f"{scope}:ip:{ip}", limit * 3)
    auth_limiter.check(f"{scope}:id:{ident.lower()}", limit)


async def _create_user(session: Session, email: str, password: str, role: str) -> User:
    user = User(email=email.strip(), password_hash=hash_password(password), role=role)
    session.add(user)
    try:
        async with session.begin_nested():
            await session.flush()
    except IntegrityError as exc:
        raise conflict("email_taken", "An account with this email already exists") from exc
    for kind in ("terms", "privacy"):
        session.add(Consent(user_id=user.id, kind=kind, granted=True))
    return user


def _token(user: User) -> TokenOut:
    return TokenOut(
        access_token=create_access_token(user.id, user.role), role=user.role, user_id=user.id
    )


@router.post("/register/candidate", response_model=TokenOut, status_code=201)
async def register_candidate(
    body: CandidateRegister, session: Session, request: Request
) -> TokenOut:
    async with system_scope(session):
        _throttle(request, "register", body.email)
        user = await _create_user(session, body.email, body.password, "candidate")
        session.add(CandidateProfile(user_id=user.id, full_name=body.full_name))
        await audit(session, user.id, "user.registered", "user", user.id, role="candidate")
        return _token(user)


@router.post("/register/employer", response_model=TokenOut, status_code=201)
async def register_employer(body: EmployerRegister, session: Session, request: Request) -> TokenOut:
    async with system_scope(session):
        _throttle(request, "register", body.email)
        if body.abn and await session.scalar(select(Employer.id).where(Employer.abn == body.abn)):
            raise conflict("abn_taken", "This ABN is already registered with NUA CREW")
        user = await _create_user(session, body.email, body.password, "employer")
        # Starts unverified: an ABN checksum is not verification; publishing needs admin review.
        employer = Employer(
            name=body.organisation_name, abn=body.abn, verification_status="unverified"
        )
        session.add(employer)
        await session.flush()
        session.add(EmployerMembership(employer_id=employer.id, user_id=user.id, role="owner"))
        if body.location:
            session.add(Location(employer_id=employer.id, **body.location.model_dump()))
        await audit(session, user.id, "employer.registered", "employer", employer.id)
        return _token(user)


@router.post("/login", response_model=TokenOut)
async def login(body: Login, session: Session, request: Request) -> TokenOut:
    _throttle(request, "login", body.email)
    user = (
        await session.scalars(select(User).where(func.lower(User.email) == body.email.lower()))
    ).one_or_none()
    ok = verify_password(body.password, user.password_hash if user else None)
    if not ok or user is None or not user.is_active:
        raise ApiError(401, "invalid_credentials", "Email or password is incorrect")
    return _token(user)


@router.get("/me", response_model=MeOut)
async def me(user: CurrentUser, session: Session) -> MeOut:
    members = await session.scalars(
        select(EmployerMembership).where(EmployerMembership.user_id == user.id)
    )
    return MeOut(
        id=user.id,
        email=user.email,
        role=user.role,
        memberships=[MembershipOut.model_validate(m) for m in members],
    )
