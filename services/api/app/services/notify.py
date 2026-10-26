import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Notification
from app.rls import system_scope


async def notify(
    session: AsyncSession,
    user_id: uuid.UUID,
    kind: str,
    title: str,
    body: str | None = None,
    **data: Any,
) -> None:
    """Notifications cross users (employer action -> candidate inbox), so insert in system scope."""
    async with system_scope(session):
        session.add(Notification(user_id=user_id, kind=kind, title=title, body=body, data=data))
