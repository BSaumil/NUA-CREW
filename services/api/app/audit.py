import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import AuditEvent


def audit(
    session: AsyncSession,
    actor_id: uuid.UUID | None,
    action: str,
    entity_type: str,
    entity_id: object | None = None,
    **meta: Any,
) -> None:
    session.add(
        AuditEvent(
            actor_user_id=actor_id,
            action=action,
            entity_type=entity_type,
            entity_id=str(entity_id) if entity_id is not None else None,
            meta=meta,
        )
    )
