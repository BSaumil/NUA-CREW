import time
import uuid
from collections import defaultdict, deque
from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError

from app.config import get_settings
from app.errors import ApiError

_hasher = PasswordHasher()
# Constant-time-ish decoy so unknown emails cost the same as wrong passwords.
_DECOY_HASH = _hasher.hash("decoy-password-for-timing")


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password: str, password_hash: str | None) -> bool:
    try:
        return _hasher.verify(password_hash or _DECOY_HASH, password) and password_hash is not None
    except (VerificationError, InvalidHashError):
        return False


def create_access_token(user_id: uuid.UUID, role: str) -> str:
    s = get_settings()
    now = datetime.now(UTC)
    claims = {
        "iss": s.jwt_issuer,
        "sub": str(user_id),
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=s.access_token_minutes),
    }
    return jwt.encode(claims, s.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> dict[str, object]:
    s = get_settings()
    try:
        return jwt.decode(
            token,
            s.jwt_secret,
            algorithms=["HS256"],
            issuer=s.jwt_issuer,
            options={"require": ["exp", "iss", "sub"]},
        )
    except jwt.PyJWTError as exc:
        raise ApiError(401, "invalid_token", "Invalid or expired token") from exc


class RateLimiter:
    """Sliding-window limiter. In-process only: replace with Redis before multi-instance use."""

    def __init__(self) -> None:
        self._hits: dict[str, deque[float]] = defaultdict(deque)

    def check(self, key: str, limit: int, window_s: int = 60) -> None:
        now = time.monotonic()
        q = self._hits[key]
        while q and now - q[0] > window_s:
            q.popleft()
        if len(q) >= limit:
            raise ApiError(429, "rate_limited", "Too many attempts. Try again shortly.")
        q.append(now)

    def reset(self) -> None:
        self._hits.clear()


auth_limiter = RateLimiter()
