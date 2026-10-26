"""Rotating refresh tokens for the mobile apps (ADR-007).

Raw tokens are random 384-bit strings shown once; only their SHA-256 is stored. Each refresh
issues a new token and retires the old one. Presenting a retired token again means it was stolen
or replayed, so the entire family (that sign-in on that device) is revoked.
"""

import hashlib
import secrets
import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.errors import ApiError
from app.models import RefreshToken, User

REFRESH_TTL = timedelta(days=30)  # sliding, per token
FAMILY_MAX_AGE = timedelta(days=90)  # absolute: the user must sign in again after this


def _hash(raw: str) -> str:
    return hashlib.sha256(raw.encode()).hexdigest()


def _unauth(code: str = "invalid_refresh_token") -> ApiError:
    return ApiError(401, code, "Please sign in again")


async def issue(
    session: AsyncSession,
    user: User,
    device_label: str | None = None,
    *,
    family_id: uuid.UUID | None = None,
    family_started_at: datetime | None = None,
    now: datetime | None = None,
) -> str:
    now = now or datetime.now(UTC)
    raw = secrets.token_urlsafe(48)
    session.add(
        RefreshToken(
            user_id=user.id,
            family_id=family_id or uuid.uuid4(),
            token_hash=_hash(raw),
            device_label=(device_label or "")[:100] or None,
            family_started_at=family_started_at or now,
            expires_at=now + REFRESH_TTL,
        )
    )
    await session.flush()
    return raw


async def rotate(session: AsyncSession, raw: str, now: datetime | None = None) -> tuple[User, str]:
    now = now or datetime.now(UTC)
    row = (
        await session.scalars(
            select(RefreshToken).where(RefreshToken.token_hash == _hash(raw)).with_for_update()
        )
    ).one_or_none()
    if row is None:
        raise _unauth()
    if row.revoked_at is not None:
        # A retired token came back: assume theft and kill every token from that sign-in.
        await revoke_family(session, row.family_id, now)
        raise _unauth("refresh_token_reuse")
    if row.expires_at <= now or row.family_started_at + FAMILY_MAX_AGE <= now:
        raise _unauth()
    user = await session.get(User, row.user_id)
    if user is None or not user.is_active:
        raise _unauth()
    row.revoked_at = now
    new = await issue(
        session,
        user,
        row.device_label,
        family_id=row.family_id,
        family_started_at=row.family_started_at,
        now=now,
    )
    return user, new


async def revoke_family(
    session: AsyncSession, family_id: uuid.UUID, now: datetime | None = None
) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=now or datetime.now(UTC))
    )


async def revoke_by_raw(session: AsyncSession, raw: str) -> None:
    """Sign out one device. Unknown tokens are ignored so logout never errors."""
    row = (
        await session.scalars(select(RefreshToken).where(RefreshToken.token_hash == _hash(raw)))
    ).one_or_none()
    if row is not None:
        await revoke_family(session, row.family_id)


async def revoke_all(session: AsyncSession, user_id: uuid.UUID) -> None:
    await session.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
    )
