"""Verified-email gate for posting jobs and applying (owner decision, 2026-11-07).

The gate only bites when email can actually be delivered. With no provider configured nobody can
receive a verification link, so enforcing it would lock every account out of posting and applying.
`gate_active()` is what the clients and the tests ask; the UI never claims an email was sent when
none can be.
"""

from app.config import get_settings
from app.errors import ApiError
from app.models import User
from app.services import email


def gate_active() -> bool:
    return get_settings().require_verified_email and email.delivery_enabled()


def require_verified_email(user: User) -> None:
    if gate_active() and user.email_verified_at is None:
        raise ApiError(
            403,
            "email_not_verified",
            "Verify your email address first. Check your inbox for the link, or ask for a new one.",
        )
