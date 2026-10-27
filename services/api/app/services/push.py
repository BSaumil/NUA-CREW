"""Push delivery through a provider adapter (Expo's push service). Disabled unless configured.

Privacy: a push only carries the notification title/body already visible in-app; no resume text or
contact details. Tokens the provider reports as dead are deleted. Nothing is sent outside the last
24 hours, and users who turned push off are skipped.
"""

import logging
from dataclasses import dataclass, field
from datetime import UTC, datetime, timedelta
from typing import Any, Protocol

import httpx
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.models import CandidateProfile, DeviceToken, Notification

log = logging.getLogger("nua.push")
FRESH_FOR = timedelta(hours=24)
EXPO_URL = "https://exp.host/--/api/v2/push/send"


@dataclass
class PushMessage:
    token: str
    title: str
    body: str | None
    data: dict[str, Any] = field(default_factory=dict)


@dataclass
class PushResult:
    token: str
    ok: bool
    dead: bool = False  # the device is gone; delete the token


class PushSender(Protocol):
    async def send(self, messages: list[PushMessage]) -> list[PushResult]: ...


class NullSender:
    """Default: do not contact any provider."""

    async def send(self, messages: list[PushMessage]) -> list[PushResult]:
        log.info("push disabled; skipped %d message(s)", len(messages))
        return [PushResult(m.token, ok=True) for m in messages]


class ExpoSender:
    async def send(self, messages: list[PushMessage]) -> list[PushResult]:
        results: list[PushResult] = []
        async with httpx.AsyncClient(timeout=10) as client:
            for i in range(0, len(messages), 100):  # Expo accepts batches of 100
                batch = messages[i : i + 100]
                payload = [
                    {
                        "to": m.token,
                        "title": m.title,
                        "body": m.body,
                        "data": m.data,
                        "sound": "default",
                    }
                    for m in batch
                ]
                try:
                    resp = await client.post(EXPO_URL, json=payload)
                    resp.raise_for_status()
                    tickets = resp.json().get("data", [])
                except (httpx.HTTPError, ValueError) as exc:
                    log.warning("expo push batch failed: %s", type(exc).__name__)
                    results += [PushResult(m.token, ok=False) for m in batch]
                    continue
                for m, t in zip(batch, tickets, strict=False):
                    dead = t.get("details", {}).get("error") == "DeviceNotRegistered"
                    results.append(PushResult(m.token, ok=t.get("status") == "ok", dead=dead))
        return results


_sender: PushSender | None = None


def get_sender() -> PushSender:
    global _sender
    if _sender is None:
        _sender = ExpoSender() if get_settings().push_provider == "expo" else NullSender()
    return _sender


def set_sender(sender: PushSender | None) -> None:
    global _sender
    _sender = sender


async def deliver_pending(
    session: AsyncSession, sender: PushSender | None = None, now: datetime | None = None
) -> int:
    """Send pushes for unprocessed notifications. Returns the number of messages sent."""
    sender = sender or get_sender()
    now = now or datetime.now(UTC)
    pending = list(
        await session.scalars(
            select(Notification)
            .where(Notification.pushed_at.is_(None))
            .order_by(Notification.created_at)
            .limit(500)
            .with_for_update(skip_locked=True)
        )
    )
    messages: list[PushMessage] = []
    for n in pending:
        n.pushed_at = now  # processed, whether or not there is anything to send
        if now - n.created_at > FRESH_FOR:
            continue
        allowed = await session.scalar(
            select(CandidateProfile.push_enabled).where(CandidateProfile.user_id == n.user_id)
        )
        if allowed is False:
            continue
        tokens = await session.scalars(
            select(DeviceToken.token).where(DeviceToken.user_id == n.user_id)
        )
        data = {"kind": n.kind, **{k: v for k, v in n.data.items() if k in _SAFE_DATA}}
        messages += [PushMessage(t, n.title, n.body, data) for t in tokens]
    if not messages:
        return 0
    dead = [r.token for r in await sender.send(messages) if r.dead]
    if dead:
        await session.execute(delete(DeviceToken).where(DeviceToken.token.in_(dead)))
    return len(messages)


# Keys safe to put in a push payload (identifiers used for deep links).
_SAFE_DATA = {
    "application_id",
    "job_id",
    "job_ids",
    "saved_search_id",
    "status",
    "count",
    "invitation_id",
    "conversation_id",
}
