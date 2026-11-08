"""Outbound email through a provider adapter. Sends nothing unless configured.

Same shape as push delivery: a small protocol, a default that does nothing, and a `set_sender` hook
for tests. Messages are plain text with one link at most. Nothing here logs a message body or a
link, because a link is a credential until it is used.

`resend` hands messages to the Resend HTTPS API. The provider is the owner's choice: another is a
small class with the same `send` method. `file` writes messages to a local folder for development
and browser tests and is refused outside development (see config).
"""

import json
import logging
import os
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

import httpx

from app.config import get_settings

log = logging.getLogger("nua.email")


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


class DeliveryError(Exception):
    """The provider refused or could not be reached. Carries a status only, never message content
    or the provider's response body (which can echo the recipient)."""


class ResendSender:
    """Transactional email through the Resend HTTPS API: plain text, no tracking added here.

    One attempt per call. The caller (`deliver`) runs after the response and never raises, and the
    resend-verification flow is the user's retry. Open and click tracking are provider-domain
    settings: leave them off for the sending domain, because a link here is a credential.
    """

    def __init__(
        self,
        api_key: str,
        sender: str,
        base_url: str = "https://api.resend.com",
        timeout: float = 8.0,
        transport: httpx.AsyncBaseTransport | None = None,
    ) -> None:
        self._key = api_key
        self._from = sender
        self._url = base_url.rstrip("/") + "/emails"
        self._timeout = timeout
        self._transport = transport

    async def send(self, message: EmailMessage) -> None:
        payload = {
            "from": self._from,
            "to": [message.to],
            "subject": message.subject,
            "text": message.text,
        }
        headers = {
            "Authorization": f"Bearer {self._key}",
            # Makes a retried identical request idempotent at the provider.
            "Idempotency-Key": uuid.uuid4().hex,
        }
        try:
            async with httpx.AsyncClient(
                timeout=self._timeout, transport=self._transport
            ) as client:
                response = await client.post(self._url, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            raise DeliveryError(f"provider unreachable ({type(exc).__name__})") from None
        if response.status_code >= 300:
            raise DeliveryError(f"provider returned HTTP {response.status_code}")
        log.info("email handed to the provider")


_sender: EmailSender | None = None


def _build_sender() -> EmailSender:
    s = get_settings()
    if s.email_provider == "file":
        return FileSender(s.email_file_dir)
    if s.email_provider == "resend":
        assert s.email_api_key is not None and s.email_from is not None  # config validated
        return ResendSender(
            s.email_api_key.get_secret_value(),
            s.email_from,
            base_url=s.email_api_base,
            timeout=s.email_timeout_seconds,
        )
    return NullSender()


def get_sender() -> EmailSender:
    global _sender
    if _sender is None:
        _sender = _build_sender()
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
    except DeliveryError as exc:
        log.error("email delivery failed: %s", exc)  # status only: no address, subject or link
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
        ),
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
        ),
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
        ),
    )
