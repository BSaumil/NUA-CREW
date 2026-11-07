"""Outbound email through a provider adapter. Sends nothing unless configured.

Same shape as push delivery: a small protocol, a default that does nothing, and a `set_sender` hook
for tests. Messages are plain text with one link at most. Nothing here logs a message body or a
link, because a link is a credential until it is used.

No real provider is wired yet; choosing one is an owner decision. `file` writes messages to a local
folder for development and browser tests and is refused outside development (see config).
"""

import json
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

from app.config import get_settings

log = logging.getLogger("nua.email")

BRAND_SIGN_OFF = "\n\nNUA CREW — Where Talent Meets Opportunity\n"


@dataclass(frozen=True)
class EmailMessage:
    to: str
    subject: str
    text: str


class EmailSender(Protocol):
    async def send(self, message: EmailMessage) -> None: ...


class NullSender:
    """Default: do not contact any provider and do not keep the message."""

    async def send(self, message: EmailMessage) -> None:
        log.info("email disabled; skipped one message")


class FileSender:
    """Development and browser tests only: one JSON file per message in a private folder."""

    def __init__(self, directory: str) -> None:
        self._dir = Path(directory)

    async def send(self, message: EmailMessage) -> None:
        self._dir.mkdir(parents=True, exist_ok=True, mode=0o700)
        stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
        path = self._dir / f"{stamp}-{uuid.uuid4().hex[:8]}.json"
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, "w", encoding="utf-8") as handle:
            json.dump({"to": message.to, "subject": message.subject, "text": message.text}, handle)
        log.info("email written to the development mail folder")


_sender: EmailSender | None = None


def get_sender() -> EmailSender:
    global _sender
    if _sender is None:
        s = get_settings()
        _sender = FileSender(s.email_file_dir) if s.email_provider == "file" else NullSender()
    return _sender


def set_sender(sender: EmailSender | None) -> None:
    global _sender
    _sender = sender


def delivery_enabled() -> bool:
    """True when a message would actually be handed to a transport. Shown to people, so the UI
    never claims an email was sent when none can be."""
    return get_settings().email_provider != "none"


async def deliver(message: EmailMessage) -> None:
    """Send and swallow failures. Runs after the response, so it must never raise or log content."""
    try:
        await get_sender().send(message)
    except Exception:
        log.exception("email delivery failed")  # no message content is attached to this record


# ---- templates: plain text, no tracking, no invented contact details ------------------------
def verification_message(to: str, link: str) -> EmailMessage:
    return EmailMessage(
        to=to,
        subject="Confirm your NUA CREW email address",
        text=(
            "Open this link to confirm your email address for NUA CREW:\n\n"
            f"{link}\n\n"
            "The link works once and expires in 24 hours. If you did not create a NUA CREW "
            "account, you can ignore this email.\n"
        )
        + BRAND_SIGN_OFF,
    )


def reset_message(to: str, link: str) -> EmailMessage:
    return EmailMessage(
        to=to,
        subject="Reset your NUA CREW password",
        text=(
            "Someone asked to reset the password for this NUA CREW account. To choose a new "
            "password, open this link:\n\n"
            f"{link}\n\n"
            "The link works once and expires in 30 minutes. If you did not ask for this, ignore "
            "this email: your password has not changed.\n"
        ) + BRAND_SIGN_OFF,
    )


def password_changed_message(to: str) -> EmailMessage:
    return EmailMessage(
        to=to,
        subject="Your NUA CREW password was changed",
        text=(
            "The password for your NUA CREW account was just changed, and you were signed out of "
            "your other devices.\n\n"
            "If this was not you, reset your password again from the sign-in page and check your "
            "account.\n"
        ) + BRAND_SIGN_OFF,
    )
