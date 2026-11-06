"""Password reset and email verification endpoints (thin: the rules live in services/recovery)."""

from fastapi import APIRouter, BackgroundTasks, Request, Response

from app.config import get_settings
from app.deps import CurrentUser, Session
from app.ratelimit import get_limiter
from app.rls import system_scope
from app.schemas import (
    EmailTokenIn,
    EmailVerifiedOut,
    ForgotPasswordIn,
    RecoveryAcceptedOut,
    ResetPasswordIn,
)
from app.services import email, recovery

router = APIRouter(prefix="/v1/auth", tags=["auth"])

HOUR = 3600


async def _limit(
    request: Request, scope: str, ident: str, *, per_id: int, per_ip: int, window_s: int
) -> None:
    ip = request.client.host if request.client else "unknown"
    limiter = get_limiter()
    await limiter.check(f"{scope}:ip:{ip}", per_ip, window_s)
    # Keyed on what was asked for, not on whether an account exists, so the limit leaks nothing.
    await limiter.check(f"{scope}:id:{ident.lower()}", per_id, window_s)


@router.post("/password/forgot", response_model=RecoveryAcceptedOut, status_code=202)
async def forgot_password(
    body: ForgotPasswordIn, session: Session, request: Request, background: BackgroundTasks
) -> RecoveryAcceptedOut:
    """Always answers the same way. If an account exists and email can be sent, a reset link is
    emailed; otherwise nothing happens."""
    await _limit(request, "forgot", body.email, per_id=3, per_ip=20, window_s=HOUR)
    async with system_scope(session):
        await recovery.request_reset(session, background, body.email)
    return RecoveryAcceptedOut(email_delivery=email.delivery_enabled())


@router.post("/password/reset", status_code=204)
async def reset_password(
    body: ResetPasswordIn, session: Session, request: Request, background: BackgroundTasks
) -> Response:
    limit = get_settings().auth_rate_limit_per_minute
    await _limit(request, "reset", body.token[:12], per_id=limit, per_ip=limit * 3, window_s=60)
    async with system_scope(session):
        await recovery.complete_reset(session, background, body.token, body.new_password)
    return Response(status_code=204)


@router.post("/email/verify/request", response_model=RecoveryAcceptedOut, status_code=202)
async def request_verification(
    user: CurrentUser,
    session: Session,
    request: Request,
    background: BackgroundTasks,
    response: Response,
) -> RecoveryAcceptedOut:
    if user.email_verified_at is not None:
        response.status_code = 200
        return RecoveryAcceptedOut(
            status="already_verified", email_delivery=email.delivery_enabled()
        )
    await _limit(request, "verify", str(user.id), per_id=3, per_ip=20, window_s=HOUR)
    async with system_scope(session):
        await recovery.start_verification(session, background, user)
    return RecoveryAcceptedOut(email_delivery=email.delivery_enabled())


@router.post("/email/verify/confirm", response_model=EmailVerifiedOut)
async def confirm_email(body: EmailTokenIn, session: Session, request: Request) -> EmailVerifiedOut:
    limit = get_settings().auth_rate_limit_per_minute
    await _limit(request, "confirm", body.token[:12], per_id=limit, per_ip=limit * 3, window_s=60)
    async with system_scope(session):
        await recovery.confirm_verification(session, body.token)
    return EmailVerifiedOut()
