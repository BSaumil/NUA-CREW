"""Fail-closed registration policy, enforced at the API (not only in the web UI).

The API accepts registration from anything that can reach it, so "sign-up is closed" is only true
if the API says so. Each role has its own switch: closed (default), allowlist, or open. A refused
request answers the same way for every email, so the response does not reveal who is allowed.
"""

from typing import Literal

from app.config import get_settings
from app.errors import ApiError

Role = Literal["candidate", "employer"]


def _allowed(email: str, entries: list[str]) -> bool:
    address = email.strip().lower()
    domain = "@" + address.rpartition("@")[2]
    for raw in entries:
        entry = raw.strip().lower()
        if entry and (entry == address or (entry.startswith("@") and entry == domain)):
            return True
    return False


def require_open(role: Role, email: str) -> None:
    settings = get_settings()
    mode = (
        settings.candidate_registration if role == "candidate" else settings.employer_registration
    )
    if mode == "open" or (mode == "allowlist" and _allowed(email, settings.registration_allowlist)):
        return
    raise ApiError(
        403,
        "registration_closed",
        "Registration is not open yet. NUA CREW is in pre-launch testing.",
    )
