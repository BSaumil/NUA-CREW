"""Password reset and email verification flows.

Rules this module keeps:
- Nothing reveals whether an email address has an account: the request path does the same visible
  work either way and the response is identical.
- Tokens are single-use, expire, and are stored only as hashes (see account_tokens).
- Completing a reset signs the person out everywhere (refresh tokens revoked) and tells them by
  email. Existing short-lived access tokens (30 minutes) cannot be revoked and expire on their own.
- When this deployment cannot send email, nothing is created: a token nobody can receive is a
  secret at rest for no reason.
"""

from datetime import UTC, datetime

from fastapi import BackgroundTasks
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.audit import audit
from app.config import get_settings
from app.errors import ApiError
from app.models import User
from app.security import hash_password
from app.services import account_tokens as account_tokens_svc
from app.services import email, tokens

INVALID_LINK = ApiError(
    400, "invalid_or_expired_token", "This link is no longer valid. Please request a new one."
)


def _link(user: User, path: str, raw: str) -> str:
    s = get_settings()
    base = s.employer_web_url if user.role == "employer" else s.candidate_web_url
    return f"{base.rstrip('/')}{path}?token={raw}"


async def request_reset(session: AsyncSession, background: BackgroundTasks, address: str) -> None:
    if not email.delivery_enabled():
        return
    user = (
        await session.scalars(select(User).where(func.lower(User.email) == address.lower()))
    ).one_or_none()
    if user is None or not user.is_active:
        account_tokens_svc.new_raw_token()  # keep the no-account path close in cost
        return
    raw = await account_tokens_svc.issue(
        session, user, account_tokens_svc.RESET, account_tokens_svc.RESET_TTL
    )
    await audit(session, user.id, "auth.password_reset_requested", "user", user.id)
    link = _link(user, "/reset-password", raw)
    background.add_task(email.deliver, email.reset_message(user.email, link))


async def complete_reset(
    session: AsyncSession, background: BackgroundTasks, raw: str, new_password: str
) -> None:
    now = datetime.now(UTC)
    row = await account_tokens_svc.consume(session, raw, account_tokens_svc.RESET, now=now)
    if row is None:
        raise INVALID_LINK
    user = await session.get(User, row.user_id)
    if user is None or not user.is_active:
        raise INVALID_LINK
    user.password_hash = hash_password(new_password)
    # The link went to this inbox, so completing it also proves the address is theirs.
    newly_verified = user.email_verified_at is None
    if newly_verified:
        user.email_verified_at = now
    await account_tokens_svc.retire_all(session, user.id, account_tokens_svc.RESET)
    await tokens.revoke_all(session, user.id)
    await audit(
        session,
        user.id,
        "auth.password_reset_completed",
        "user",
        user.id,
        email_verified_by_reset=newly_verified,
    )
    if email.delivery_enabled():
        background.add_task(email.deliver, email.password_changed_message(user.email))


async def start_verification(
    session: AsyncSession, background: BackgroundTasks, user: User
) -> bool:
    """Send a verification email. Returns False when nothing was sent (already verified, or this
    deployment cannot send email)."""
    if user.email_verified_at is not None or not email.delivery_enabled():
        return False
    raw = await account_tokens_svc.issue(
        session, user, account_tokens_svc.VERIFY, account_tokens_svc.VERIFY_TTL
    )
    await audit(session, user.id, "email.verification_sent", "user", user.id)
    link = _link(user, "/verify-email", raw)
    background.add_task(email.deliver, email.verification_message(user.email, link))
    return True


async def confirm_verification(session: AsyncSession, raw: str) -> None:
    row = await account_tokens_svc.consume(session, raw, account_tokens_svc.VERIFY)
    if row is None:
        raise INVALID_LINK
    user = await session.get(User, row.user_id)
    if user is None or not user.is_active or user.email.strip().lower() != (row.email or ""):
        raise INVALID_LINK
    if user.email_verified_at is None:
        user.email_verified_at = datetime.now(UTC)
        await audit(session, user.id, "email.verified", "user", user.id)
