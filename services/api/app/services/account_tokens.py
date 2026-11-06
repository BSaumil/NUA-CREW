"""One-time email tokens (password reset, email verification).

Raw tokens are random 256-bit strings shown once, in an email; only their SHA-256 is stored. A token
works once, expires, is tied to a purpose, and requesting a new one retires the older ones. All
functions expect to run in system scope: the endpoints that use them are not signed in.
"""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuthToken, User

RESET_TTL = timedelta(minutes=30)
VERIFY_TTL = timedelta(hours=24)

RESET = "password_reset"
VERIFY = "email_verification"


def hash_token(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def new_raw_token() -> str:
    return secrets.token_urlsafe(32)


async def issue(
    session: AsyncSession,
    user: User,
    purpose: str,
    ttl: timedelta,
    *,
    now: datetime | None = None,
) -> str:
    """Create a token, retiring older unused ones of the same purpose. Returns the raw token."""
    now = now or datetime.now(UTC)
    await session.execute(
        delete(AuthToken).where(
            AuthToken.user_id == user.id,
            AuthToken.purpose == purpose,
            AuthToken.used_at.is_(None),
        )
    )
    raw = new_raw_token()
    session.add(
        AuthToken(
            user_id=user.id,
            purpose=purpose,
            token_hash=hash_token(raw),
            email=user.email.strip().lower() if purpose == VERIFY else None,
            expires_at=now + ttl,
        )
    )
    await session.flush()
    return raw


async def consume(
    session: AsyncSession, raw: str, purpose: str, *, now: datetime | None = None
) -> AuthToken | None:
    """Mark a valid token used and return it. Unknown, expired, used or wrong-purpose tokens all
    return None, so a caller cannot tell them apart."""
    now = now or datetime.now(UTC)
    row = (
        await session.scalars(
            select(AuthToken)
            .where(AuthToken.token_hash == hash_token(raw), AuthToken.purpose == purpose)
            .with_for_update()
        )
    ).one_or_none()
    if row is None or row.used_at is not None or row.expires_at <= now:
        return None
    row.used_at = now
    return row


async def retire_all(session: AsyncSession, user_id: uuid.UUID, purpose: str) -> None:
    await session.execute(
        delete(AuthToken).where(
            AuthToken.user_id == user_id,
            AuthToken.purpose == purpose,
            AuthToken.used_at.is_(None),
        )
    )
