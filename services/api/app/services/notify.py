import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notification


def notify(
    session: AsyncSession,
    user_id: uuid.UUID,
    kind: str,
    title: str,
    body: str | None = None,
    **data: Any,
) -> None:
    session.add(Notification(user_id=user_id, kind=kind, title=title, body=body, data=data))
