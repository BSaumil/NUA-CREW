"""Verified-email gate for posting jobs and applying.

Development may run without mail so local fixtures are not stranded. In staging
and production, absence of a usable mail transport must block sensitive hiring
writes rather than silently skipping the verification requirement.
"""

from app.config import get_settings
from app.errors import ApiError
from app.models import User
from app.services import email


def gate_active() -> bool:
    settings = get_settings()
    return settings.require_verified_email and (
        email.delivery_enabled() or settings.env != "development"
    )


def require_verified_email(user: User) -> None:
    if not gate_active():
        return
    if not email.delivery_enabled():
        raise ApiError(
            503,
            "email_verification_unavailable",
            "Email verification is temporarily unavailable. Job posting and applications "
            "cannot proceed until it is restored.",
        )
    if user.email_verified_at is None:
        raise ApiError(
            403,
            "email_not_verified",
            "Verify your email address first. Check your inbox for the link, or ask for a new one.",
        )
